import type {
  DiagnosisResult,
  EffortEstimate,
  ExtractionResult,
  ProposalResult,
  SafetyFinding,
} from '../../shared/schemas/ai'
import type { UserProfile } from '../../shared/types'
import { estimateEffortHeuristic } from '../domain/money'
import { buildAxes, decideRecommendation } from '../domain/recommendation'

export interface ExtractionInput {
  title: string
  body: string
}

export interface EstimateInput {
  title: string
  body: string
  client: Record<string, unknown>
  profile: UserProfile
  safety: SafetyFinding[]
}

export interface DiagnosisInput {
  title: string
  body: string
  extraction: ExtractionResult
  safety: SafetyFinding[]
  effort: EffortEstimate
  profile: UserProfile
  budgetMinYen: number | null
  feeRatePercent: number
  deadlineDays?: number | null
  applicants?: number | null
}

export interface ProposalInput {
  title: string
  diagnosis: DiagnosisResult
  extraction: ExtractionResult
  profile: UserProfile
  forceStrategy?: string
}

export interface ReplyInput {
  title: string
  replyBody: string
  profile: UserProfile
}

export interface AiProvider {
  extract(input: ExtractionInput): Promise<ExtractionResult>
  estimate(input: EstimateInput): Promise<EffortEstimate>
  diagnose(input: DiagnosisInput): Promise<DiagnosisResult>
  generateProposal(input: ProposalInput): Promise<ProposalResult>
  assistReply(input: ReplyInput): Promise<import('../../shared/schemas/ai').ReplyAssistResult>
}

function extractByHeuristics(title: string, body: string): ExtractionResult {
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const deliverables: ExtractionResult['deliverables'] = []
  const skills: ExtractionResult['requiredSkills'] = []
  const unknowns: string[] = []

  const skillHints = ['Laravel', 'Vue', 'React', 'TypeScript', 'PHP', 'Python', 'Next.js', 'Nuxt', 'SQL', 'AWS', 'Docker']
  for (const hint of skillHints) {
    if (body.includes(hint) || title.includes(hint)) {
      const idx = (body + title).indexOf(hint)
      const src = body.includes(hint) ? body : title
      const start = Math.max(0, src.indexOf(hint) - 4)
      skills.push({
        text: hint,
        provenance: 'confirmed',
        quote: src.slice(start, start + hint.length + 8).trim(),
      })
    }
  }

  for (const line of lines) {
    if (/成果物|納品|作成|開発|実装|構築/.test(line)) {
      deliverables.push({
        text: line.slice(0, 80),
        provenance: 'inferred',
        quote: '',
      })
    }
  }

  if (deliverables.length === 0) {
    unknowns.push('成果物の具体内容')
  }
  if (!/円|予算|報酬|単価/.test(body)) unknowns.push('予算')
  if (!/納期|期限|まで|週間|日以内/.test(body)) unknowns.push('納期')
  if (!/MTG|ミーティング|打ち合わせ|連絡/.test(body)) unknowns.push('MTG・連絡条件')
  if (!/修正/.test(body)) unknowns.push('修正条件')

  const budgetMatch = body.match(/([0-9０-９,，]+)\s*円/)
  const deadlineMatch = body.match(/(納期[:：]?\s*[^\n]{2,40}|[0-9０-９]+日以内|[0-9０-９]+週間)/)

  return {
    deliverables: deliverables.slice(0, 5),
    requiredSkills: skills,
    budget: budgetMatch
      ? { text: budgetMatch[0], provenance: 'confirmed', quote: budgetMatch[0] }
      : { text: '不明', provenance: 'unknown', quote: '' },
    deadline: deadlineMatch
      ? { text: deadlineMatch[0], provenance: 'confirmed', quote: deadlineMatch[0] }
      : { text: '不明', provenance: 'unknown', quote: '' },
    mtgConditions: /MTG|ミーティング|打ち合わせ/.test(body)
      ? { text: '募集文に記載あり', provenance: 'inferred', quote: '' }
      : { text: '不明', provenance: 'unknown', quote: '' },
    maintenance: /保守|運用|障害/.test(body)
      ? { text: '保守・運用の記載あり', provenance: 'inferred', quote: '' }
      : { text: '不明', provenance: 'unknown', quote: '' },
    revisionTerms: /修正/.test(body)
      ? { text: '修正に関する記載あり', provenance: 'inferred', quote: '' }
      : { text: '不明', provenance: 'unknown', quote: '' },
    selectionCriteria: /歓迎|必須|経験者/.test(body)
      ? { text: '選定に関する記載あり', provenance: 'inferred', quote: '' }
      : { text: '不明', provenance: 'unknown', quote: '' },
    unknowns,
  }
}

function buildProposalFallback(input: ProposalInput): ProposalResult {
  const name = input.profile.name || '応募者'
  const skills = input.profile.skills.map((s) => s.name).filter(Boolean).slice(0, 5)
  const achievements = input.profile.achievements
    .filter((a) => a.usableInProposal !== false)
    .slice(0, 2)
  const problem = input.diagnosis.clientIntent?.underlyingProblem || '募集内容の課題解決'
  const strategy =
    input.forceStrategy ||
    (achievements.length ? '実績・証拠型' : '進め方明確型')
  const used = achievements.map((a) => a.title)

  const body = [
    `はじめまして。${name}と申します。`,
    `募集内容を拝見し、${problem}に対して、段階的に進められる提案ができると考え応募しました。`,
    skills.length ? `対応可能な技術は ${skills.join('、')} です。` : '',
    achievements.length
      ? `関連実績として、${achievements.map((a) => `${a.title}${a.result ? `（${a.result}）` : ''}`).join('、')} があります。`
      : '',
    strategy === '課題解決型'
      ? `課題に対しては、現状のボトルネックを切り分けたうえで、最短で効果が出る範囲から着手します。`
      : strategy === '実績・証拠型'
        ? `近い案件での進め方と成果を踏まえ、同じ品質で進められると考えています。`
        : `進め方としては、①要件の確認 ②小さく動く成果物の提示 ③フィードバック反映 の順で進めます。`,
    `対応可能時間は ${input.profile.availableTimes || '要相談'} です。`,
    input.diagnosis.preQuestions?.length
      ? `応募前の確認として、${input.diagnosis.preQuestions.slice(0, 2).join('／')} を伺えれば幸いです。`
      : '詳細な要件や優先順位を確認できれば、より正確な進め方をご提示できます。',
    'ご検討のほど、よろしくお願いいたします。',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    strategy,
    strategyReason:
      input.forceStrategy
        ? `ユーザー指定の「${strategy}」で再生成しました`
        : achievements.length
          ? '近い実績を提示できるため'
          : '要件整理と段階的な進め方が安心材料になるため',
    body,
    usedAchievements: used,
    preQuestions: input.diagnosis.preQuestions || [],
    assumptions: ['募集文に書かれた範囲を対象とする', '大幅な追加要件は再見積り'],
    scopeIn: input.diagnosis.scopeIn?.length ? input.diagnosis.scopeIn : ['募集文に記載の主要成果物'],
    scopeOut: input.diagnosis.scopeOut?.length ? input.diagnosis.scopeOut : ['明記のない保守運用', '追加機能の無償対応'],
    meetingTopics: ['成功条件の定義', '優先機能', '連絡頻度'],
  }
}

function buildReplyAssist(input: ReplyInput) {
  const body = input.replyBody
  const questions = body.split(/[？\?]/).slice(0, -1).map((q) => q.trim().slice(-40)).filter(Boolean).slice(0, 5)
  const conditionChanges: string[] = []
  if (/納期|期限/.test(body)) conditionChanges.push('納期・期限に関する記載あり')
  if (/予算|金額|円/.test(body)) conditionChanges.push('予算・金額に関する記載あり')
  if (/追加|範囲|スコープ/.test(body)) conditionChanges.push('範囲・追加要件の可能性')
  if (/保守|運用/.test(body)) conditionChanges.push('保守・運用条件の言及')
  const needsReestimate = conditionChanges.length > 0

  const draftReply = [
    `${input.profile.name || '応募者'}です。ご連絡ありがとうございます。`,
    questions.length ? `ご質問の件、順に回答します。` : '内容を確認しました。',
    ...questions.map((q, i) => `${i + 1}. 「${q}？」について: （ここに回答を記入）`),
    needsReestimate
      ? '条件変更の可能性があるため、対応範囲と工数を一度整理したうえでご提案し直します。'
      : '不明点があれば追加で確認させてください。',
    '引き続きよろしくお願いいたします。',
  ].join('\n')

  return {
    questions: questions.map((q) => `${q}？`),
    newRequirements: /追加|新たに/.test(body) ? ['追加要件の記載あり（要確認）'] : [],
    conditionChanges,
    needsReply: questions.length ? questions.map((q) => `${q}？への回答`) : ['内容への返信'],
    newRisks: /即日|常時|無償/.test(body) ? ['稼働・無償条件リスクの再確認'] : [],
    needsReestimate,
    draftReply,
    followUpQuestions: needsReestimate ? ['変更後の確定納期', '変更後の予算上限', '必須範囲'] : ['次のステップ'],
  }
}

/** Offline / no-key provider that keeps rule-based judgment usable (spec §17.2 / §19.6). */
export class FallbackAiProvider implements AiProvider {
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    return extractByHeuristics(input.title, input.body)
  }

  async estimate(input: EstimateInput): Promise<EffortEstimate> {
    return estimateEffortHeuristic(input.body, input.title)
  }

  async diagnose(input: DiagnosisInput): Promise<DiagnosisResult> {
    const decision = decideRecommendation({
      safety: input.safety,
      effort: input.effort,
      extraction: input.extraction,
      profile: input.profile,
      budgetMinYen: input.budgetMinYen,
      feeRatePercent: input.feeRatePercent,
      deadlineDays: input.deadlineDays,
      applicants: input.applicants,
    })

    const axes = buildAxes({
      safety: input.safety,
      effort: input.effort,
      extraction: input.extraction,
      profile: input.profile,
      budgetMinYen: input.budgetMinYen,
      feeRatePercent: input.feeRatePercent,
      deadlineDays: input.deadlineDays,
      applicants: input.applicants,
      decision,
    })

    const preQuestions = [
      ...(input.extraction.unknowns || []).map((u) => `${u}を教えてください`),
      ...input.safety
        .filter((s) => s.classification !== 'BLOCK' && s.status === 'open')
        .slice(0, 3)
        .map((s) => s.reason.replace(/です$/, '') + 'について、現状を教えてください'),
    ].slice(0, 5)

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
      preQuestions,
      scopeIn: input.extraction.deliverables.filter((d) => d.provenance === 'confirmed').map((d) => d.text),
      scopeOut: ['募集文にない追加機能', '無償の長期保守'],
    }
  }

  async generateProposal(input: ProposalInput): Promise<ProposalResult> {
    return buildProposalFallback(input)
  }

  async assistReply(input: ReplyInput) {
    return buildReplyAssist(input)
  }
}

export function getAiProvider(): AiProvider {
  // External providers (Anthropic / Workers AI) can be swapped here via runtimeConfig.
  // MVP ships with fallback so dogfooding works without API keys.
  return new FallbackAiProvider()
}
