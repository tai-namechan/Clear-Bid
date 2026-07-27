import {
  DiagnosisResultSchema,
  ExtractionResultSchema,
  EffortEstimateSchema,
  ProposalResultSchema,
  ReplyAssistSchema,
  type DiagnosisResult,
  type EffortEstimate,
  type ExtractionResult,
  type ProposalResult,
  type ReplyAssistResult,
} from '../../shared/schemas/ai'
import { decideRecommendation, buildAxes } from '../domain/recommendation'
import { estimateEffortHeuristic } from '../domain/money'
import {
  enrichExtractionForFlexy,
  type AiProvider,
  type DiagnosisInput,
  type EstimateInput,
  type ExtractionInput,
  type ProposalInput,
  type ReplyInput,
} from './provider'
import { buildFlexyInterestMessage } from './flexyMessage'

const MODEL = 'claude-sonnet-4-20250514'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1] ? fenced[1].trim() : trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('JSON object not found in model response')
  return JSON.parse(raw.slice(start, end + 1))
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Anthropic response missing text')
  return text
}

export class AnthropicAiProvider implements AiProvider {
  constructor(private readonly apiKey: string) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const isFlexy = input.platform === 'flexy'
    const system = isFlexy
      ? `あなたはFLEXY等の継続支援案件の募集文を構造化するアシスタントです。
必ず JSON オブジェクトのみを返してください。説明文は禁止です。
スキーマ:
{
  "deliverables": [{"text": string, "provenance": "confirmed"|"inferred"|"unknown", "quote": string}],
  "requiredSkills": [{"text": string, "provenance": "...", "quote": string}],
  "budget": {"text": string, "provenance": "...", "quote": string},
  "deadline": {"text": string, "provenance": "...", "quote": string},
  "mtgConditions": {"text": string, "provenance": "...", "quote": string},
  "maintenance": {"text": string, "provenance": "...", "quote": string},
  "revisionTerms": {"text": string, "provenance": "...", "quote": string},
  "selectionCriteria": {"text": string, "provenance": "...", "quote": string},
  "unknowns": string[],
  "companyName": {"text": string, "provenance": "...", "quote": string},
  "role": {"text": string, "provenance": "...", "quote": string},
  "workStyle": {"text": string, "provenance": "...", "quote": string},
  "workLocation": {"text": string, "provenance": "...", "quote": string},
  "workDays": {"text": string, "provenance": "...", "quote": string},
  "requiredAvailability": {"text": string, "provenance": "...", "quote": string},
  "recruitmentBackground": {"text": string, "provenance": "...", "quote": string},
  "requiredRequirements": [{"text": string, "provenance": "...", "quote": string}],
  "preferredRequirements": [{"text": string, "provenance": "...", "quote": string}]
}
ルール:
- confirmed は募集文に明示がある場合のみ。quote には原文の短い抜粋を入れる。
- 必須要件と歓迎要件は混ぜない。
- 「LLM API・RAG・構造化出力」のような複合は原子的に分割する（別要素にする）。
- 週N日から月間時間を推定しない。月間時間の記載がなければ unknowns に「月間稼働時間」。
- 金額計算・推奨・BLOCK判定はしない。抽出のみ。`
      : `あなたはフリーランス案件の募集文を構造化するアシスタントです。
必ず JSON オブジェクトのみを返してください。説明文は禁止です。
スキーマ:
{
  "deliverables": [{"text": string, "provenance": "confirmed"|"inferred"|"unknown", "quote": string}],
  "requiredSkills": [{"text": string, "provenance": "...", "quote": string}],
  "budget": {"text": string, "provenance": "...", "quote": string},
  "deadline": {"text": string, "provenance": "...", "quote": string},
  "mtgConditions": {"text": string, "provenance": "...", "quote": string},
  "maintenance": {"text": string, "provenance": "...", "quote": string},
  "revisionTerms": {"text": string, "provenance": "...", "quote": string},
  "selectionCriteria": {"text": string, "provenance": "...", "quote": string},
  "unknowns": string[]
}
ルール:
- confirmed は募集文に明示がある場合のみ。quote には原文の短い抜粋を入れる。
- 推測は inferred。不明は unknown と unknowns に入れる。
- 金額・推奨・BLOCK判定はしない。抽出のみ。`

    const user = `タイトル: ${input.title}\n\n本文:\n${input.body}`
    const text = await callAnthropic(this.apiKey, system, user)
    const parsed = ExtractionResultSchema.safeParse(extractJson(text))
    if (!parsed.success) throw new Error('Extraction schema invalid')
    return enrichExtractionForFlexy(parsed.data, input.title, input.body, input.platform)
  }

  async estimate(input: EstimateInput): Promise<EffortEstimate> {
    const system = `あなたはフリーランス案件の工数見積りアシスタントです。
必ず JSON オブジェクトのみを返してください。
スキーマ:
{
  "tasks": [{"category": string, "min": number, "likely": number, "max": number, "assumption": string}],
  "bufferRate": number,
  "bufferReason": string
}
単位は時間(h)。min <= likely <= max。bufferRate は 0〜1。
過大見積りより、根拠のある実務的な見積りを優先。`

    const user = JSON.stringify({
      title: input.title,
      body: input.body.slice(0, 6000),
      profileHours: input.profile.weeklyHours,
      skills: input.profile.skills.map((s) => s.name),
    })
    try {
      const text = await callAnthropic(this.apiKey, system, user)
      const parsed = EffortEstimateSchema.safeParse(extractJson(text))
      if (!parsed.success) throw new Error('Effort schema invalid')
      return parsed.data
    } catch {
      return estimateEffortHeuristic(input.body, input.title)
    }
  }

  async diagnose(input: DiagnosisInput): Promise<DiagnosisResult> {
    // Money / recommendation / BLOCK finalization stay in app rules.
    const decision = decideRecommendation({
      safety: input.safety,
      effort: input.effort,
      extraction: input.extraction,
      profile: input.profile,
      budgetMinYen: input.budgetMinYen,
      budgetMaxYen: input.budgetMaxYen,
      feeRatePercent: input.feeRatePercent,
      deadlineDays: input.deadlineDays,
      applicants: input.applicants,
      engagementType: input.engagementType,
      budgetType: input.budgetType,
      expectedMonthlyHoursMin: input.expectedMonthlyHoursMin,
      expectedMonthlyHoursMax: input.expectedMonthlyHoursMax,
      requirementEvidences: input.requirementEvidences,
    })
    const axes = buildAxes({
      safety: input.safety,
      effort: input.effort,
      extraction: input.extraction,
      profile: input.profile,
      budgetMinYen: input.budgetMinYen,
      budgetMaxYen: input.budgetMaxYen,
      feeRatePercent: input.feeRatePercent,
      deadlineDays: input.deadlineDays,
      applicants: input.applicants,
      engagementType: input.engagementType,
      budgetType: input.budgetType,
      expectedMonthlyHoursMin: input.expectedMonthlyHoursMin,
      expectedMonthlyHoursMax: input.expectedMonthlyHoursMax,
      requirementEvidences: input.requirementEvidences,
      decision,
    })

    const system = `あなたはフリーランス案件の診断アシスタントです。
推奨判定（応募/質問/見送り）と金額計算はアプリ側で確定済みです。上書き禁止。
必ず JSON オブジェクトのみを返してください。
スキーマ:
{
  "clientIntent": {
    "underlyingProblem": string,
    "selectionPriority": string,
    "concerns": string,
    "evidenceNeeded": string
  },
  "preQuestions": string[],
  "scopeIn": string[],
  "scopeOut": string[],
  "axisNotes": [{"axis": "safety"|"fitness"|"feasibility"|"profitability"|"winChance", "reason": string, "facts": string[], "missing": string[]}]
}
日本語。実務的で短く。`

    const user = JSON.stringify({
      title: input.title,
      body: input.body.slice(0, 5000),
      extraction: input.extraction,
      safety: input.safety.filter((s) => s.status === 'open').slice(0, 8),
      effort: input.effort,
      recommendation: decision.recommendation,
      recommendationReason: decision.reason,
      selfCheckQuestions: decision.selfCheckQuestions,
      consultantQuestions: decision.consultantQuestions,
      profile: {
        skills: input.profile.skills,
        achievements: input.profile.achievements,
        weeklyHours: input.profile.weeklyHours,
        minHourlyYen: input.profile.minHourlyYen,
        ngConditions: input.profile.ngConditions,
      },
    })

    try {
      const text = await callAnthropic(this.apiKey, system, user)
      const enriched = extractJson(text) as {
        clientIntent?: DiagnosisResult['clientIntent']
        preQuestions?: string[]
        scopeIn?: string[]
        scopeOut?: string[]
        axisNotes?: Array<{ axis: string; reason?: string; facts?: string[]; missing?: string[] }>
      }
      const noteMap = new Map((enriched.axisNotes || []).map((n) => [n.axis, n]))
      const mergedAxes = axes.map((a) => {
        const n = noteMap.get(a.axis)
        if (!n) return a
        return {
          ...a,
          reason: n.reason || a.reason,
          facts: n.facts?.length ? n.facts : a.facts,
          missing: n.missing?.length ? n.missing : a.missing,
        }
      })
      const mergedQuestions = [
        ...decision.selfCheckQuestions,
        ...decision.consultantQuestions,
        ...(enriched.preQuestions || []),
      ]
      const result = {
        axes: mergedAxes,
        recommendation: decision.recommendation,
        recommendationReason: decision.reason,
        clientIntent: enriched.clientIntent,
        preQuestions: [...new Set(mergedQuestions)].slice(0, 8),
        scopeIn: enriched.scopeIn || [],
        scopeOut: enriched.scopeOut || [],
      }
      const parsed = DiagnosisResultSchema.safeParse(result)
      if (!parsed.success) throw new Error('Diagnosis schema invalid')
      return parsed.data
    } catch {
      const preQuestions = [
        ...decision.selfCheckQuestions,
        ...decision.consultantQuestions,
        ...(input.extraction.unknowns || []).map((u) => `${u}を教えてください`),
      ]
      return {
        axes,
        recommendation: decision.recommendation,
        recommendationReason: decision.reason,
        clientIntent: {
          underlyingProblem: '募集文から読み取れる業務課題の解消',
          selectionPriority: '確実な完遂とコミュニケーション',
          concerns: '要件の食い違いや納期遅延',
          evidenceNeeded: '類似実績と進め方の具体性',
        },
        preQuestions: [...new Set(preQuestions)].slice(0, 8),
        scopeIn: input.extraction.deliverables.filter((d) => d.provenance === 'confirmed').map((d) => d.text),
        scopeOut: ['募集文にない追加機能', '無償の長期保守'],
      }
    }
  }

  async generateProposal(input: ProposalInput): Promise<ProposalResult> {
    if (input.platform === 'flexy') {
      try {
        const system = `あなたはFLEXY担当者向けの応募希望メッセージライターです。
企業への直接営業文は禁止。担当コンサルタント宛にする。
必ず JSON オブジェクトのみを返してください。
スキーマ:
{
  "strategy": string,
  "strategyReason": string,
  "body": string,
  "usedAchievements": string[],
  "preQuestions": string[],
  "assumptions": string[],
  "scopeIn": string[],
  "scopeOut": string[],
  "meetingTopics": string[],
  "documentType": "interest_message"
}
制約:
- 日本語。250〜500字目安。
- 「FLEXYご担当者様」など担当者向け。
- requirementEvidences で status=supported かつ evidenceNote があるものだけ経験として書いてよい。
- unverified / partial / unsupported の経験は絶対に書かない。
- 「必ず」「絶対」等の保証禁止。URLは入力にある場合のみ。捏造禁止。
- documentType は必ず interest_message。`

        const user = JSON.stringify({
          title: input.title,
          jobUrl: input.jobUrl || null,
          diagnosis: input.diagnosis,
          extraction: {
            role: input.extraction.role,
            workDays: input.extraction.workDays,
            requiredAvailability: input.extraction.requiredAvailability,
          },
          requirementEvidences: (input.requirementEvidences || []).filter((e) => e.status === 'supported'),
          consultantQuestions: input.consultantQuestions || input.diagnosis.preQuestions,
          profile: {
            name: input.profile.name,
            availableTimes: input.profile.availableTimes,
            weeklyHours: input.profile.weeklyHours,
          },
        })
        const text = await callAnthropic(this.apiKey, system, user)
        const parsed = ProposalResultSchema.safeParse(extractJson(text))
        if (!parsed.success) throw new Error('Proposal schema invalid')
        return { ...parsed.data, documentType: 'interest_message' }
      } catch {
        return buildFlexyInterestMessage(input)
      }
    }

    const system = `あなたはクラウドソーシング向けの提案文ライターです。
必ず JSON オブジェクトのみを返してください。
スキーマ:
{
  "strategy": "課題解決型"|"実績・証拠型"|"進め方明確型",
  "strategyReason": string,
  "body": string,
  "usedAchievements": string[],
  "preQuestions": string[],
  "assumptions": string[],
  "scopeIn": string[],
  "scopeOut": string[],
  "meetingTopics": string[],
  "documentType": "proposal"
}
制約:
- 日本語。営業っぽい誇張・虚偽実績禁止。
- プロフィールにない実績を捏造しない。
- 400〜800字程度。丁寧だが簡潔。
- forceStrategy があればその型を使う。
- documentType は proposal。`

    const user = JSON.stringify({
      title: input.title,
      forceStrategy: input.forceStrategy || null,
      diagnosis: input.diagnosis,
      extraction: input.extraction,
      profile: {
        name: input.profile.name,
        availableTimes: input.profile.availableTimes,
        mtgLimit: input.profile.mtgLimit,
        skills: input.profile.skills.filter((s) => s.usableInProposal !== false),
        achievements: input.profile.achievements.filter((a) => a.usableInProposal !== false),
      },
    })
    const text = await callAnthropic(this.apiKey, system, user)
    const parsed = ProposalResultSchema.safeParse(extractJson(text))
    if (!parsed.success) throw new Error('Proposal schema invalid')
    if (input.forceStrategy) {
      return {
        ...parsed.data,
        strategy: input.forceStrategy,
        strategyReason: `ユーザー指定の「${input.forceStrategy}」で再生成しました`,
        documentType: 'proposal',
      }
    }
    return { ...parsed.data, documentType: 'proposal' }
  }

  async assistReply(input: ReplyInput): Promise<ReplyAssistResult> {
    const system = `あなたはフリーランスの返信支援アシスタントです。
発注者からの返信を解析し、回答案を作ります。
必ず JSON オブジェクトのみを返してください。
スキーマ:
{
  "questions": string[],
  "newRequirements": string[],
  "conditionChanges": string[],
  "needsReply": string[],
  "newRisks": string[],
  "needsReestimate": boolean,
  "draftReply": string,
  "followUpQuestions": string[]
}
制約:
- 虚偽の約束や確定金額の勝手な提示はしない。
- 条件変更（納期・予算・範囲・保守）があれば needsReestimate=true。
- draftReply はすぐ送れる丁寧な日本語。未確定点は確認質問にする。`

    const user = JSON.stringify({
      title: input.title,
      replyBody: input.replyBody,
      profileName: input.profile.name,
    })
    const text = await callAnthropic(this.apiKey, system, user)
    const parsed = ReplyAssistSchema.safeParse(extractJson(text))
    if (!parsed.success) throw new Error('Reply schema invalid')
    return parsed.data
  }
}
