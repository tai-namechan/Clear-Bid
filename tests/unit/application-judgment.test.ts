import { describe, expect, it } from 'vitest'
import {
  classifyRequirementAgainstProfile,
  decideApplicationAction,
  inferPlatformFromText,
} from '../../shared/domain/applicationJudgment'
import { DiagnosisResultSchema, ProposalResultSchema } from '../../shared/schemas/ai'
import type { ExtractionResult } from '../../shared/schemas/ai'
import { INIT_PROFILE, normalizeProfile, type UserProfile } from '../../shared/types'
import { FallbackAiProvider } from '../../server/ai/provider'
import { buildYoutrustMessage } from '../../server/ai/platformMessage'
import { canTransition } from '../../shared/domain/pipeline'

/**
 * 証明: 匿名化した5ケースで、捏造なし・関心と実務の区別・媒体別メッセージ品質・
 * 推奨アクション整合が決定的ロジック＋フォールバック生成で成立すること。
 */

const baseProfile: UserProfile = normalizeProfile({
  ...INIT_PROFILE,
  name: '応募者A',
  weeklyHours: 10,
  availableTimes: '平日夜・週末',
  mtgLimit: '週1回まで',
  minHourlyYen: 3000,
  skills: [
    { name: 'TypeScript', level: '実務', years: 4, usableInProposal: true },
    { name: '要件整理', level: '実務', years: 5, usableInProposal: true },
    { name: '業務改善', level: '実務', years: 5, usableInProposal: true },
    { name: 'Web開発', level: '実務', years: 4, usableInProposal: true },
    { name: 'API連携', level: '実務', years: 3, usableInProposal: true },
    { name: 'Python', level: '個人開発', years: 1, usableInProposal: true },
  ],
  achievements: [
    {
      title: '社内業務フローの改善と要件整理',
      action: '現場ヒアリングと仕様調査',
      result: '手作業を削減',
      tech: ['TypeScript', '業務改善'],
      usableInProposal: true,
    },
    {
      title: 'WebアプリへのAPI連携機能追加',
      action: '既存サービスの改修',
      result: '連携処理を安定化',
      tech: ['TypeScript', 'API連携'],
      usableInProposal: true,
    },
  ],
  interestAreas: {
    technologies: ['顧客体験改善SaaS', '音声AI'],
    companies: [],
    domains: ['業務のAI化'],
  },
  ngConditions: ['常時対応必須'],
})

function extractionFrom(opts: {
  required: string[]
  preferred?: string[]
  role?: string
  budgetUnknown?: boolean
}): ExtractionResult {
  return {
    deliverables: opts.role
      ? [{ text: opts.role, provenance: 'confirmed', quote: opts.role }]
      : [],
    requiredSkills: opts.required.map((t) => ({ text: t, provenance: 'confirmed' as const, quote: t })),
    requiredRequirements: opts.required.map((t) => ({ text: t, provenance: 'confirmed' as const, quote: t })),
    preferredRequirements: (opts.preferred || []).map((t) => ({
      text: t,
      provenance: 'confirmed' as const,
      quote: t,
    })),
    budget: opts.budgetUnknown
      ? { text: '不明', provenance: 'unknown', quote: '' }
      : { text: '応相談', provenance: 'inferred', quote: '' },
    deadline: { text: '継続', provenance: 'inferred', quote: '' },
    mtgConditions: { text: '不明', provenance: 'unknown', quote: '' },
    maintenance: { text: '不明', provenance: 'unknown', quote: '' },
    revisionTerms: { text: '不明', provenance: 'unknown', quote: '' },
    selectionCriteria: { text: '必須要件参照', provenance: 'inferred', quote: '' },
    unknowns: opts.budgetUnknown ? ['報酬'] : [],
    role: opts.role ? { text: opts.role, provenance: 'confirmed', quote: opts.role } : undefined,
  }
}

const emptyEffort = {
  tasks: [{ category: '要件確認', min: 2, likely: 4, max: 8, assumption: '' }],
  bufferRate: 0.2,
  bufferReason: '',
}

describe('platform inference', () => {
  it('infers youtrust from pasted text without scraping', () => {
    expect(inferPlatformFromText('面談募集', 'YouTrustで見つけました', '')).toBe('youtrust')
    expect(inferPlatformFromText('案件', 'FLEXY経由', '')).toBe('flexy')
  })
})

describe('interest vs practical experience', () => {
  it('does not treat interest-only SaaS as matched practical experience', () => {
    const r = classifyRequirementAgainstProfile(
      '顧客体験改善SaaSの実装・運用経験',
      'required',
      baseProfile,
    )
    expect(r.status).toBe('missing')
    expect(r.reason).toMatch(/関心|学習|実務経験としては確認できない/)
  })
})

describe('acceptance case 1: web ops improvement', () => {
  const title = '継続中Webサービス改善'
  const body = `
継続運用中のWebサービス・業務システムの改善。
現場担当者へのヒアリング、既存仕様の調査、要件整理、機能改修。
TypeScript系のWeb開発経験が歓迎。
一部のフロントエンド技術は未経験でもキャッチアップ可。
副業・リモート可。
`.trim()

  it('values process experience and does not invent unknown frontend skills', async () => {
    const extraction = extractionFrom({
      required: ['要件整理', '業務システム改善', '現場ヒアリング'],
      preferred: ['TypeScript', '未知のフロントエンドフレームワーク'],
      role: 'Webサービス改善',
    })
    const decision = decideApplicationAction({
      title,
      body,
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'apply',
      legacyReason: '条件を満たしています',
      applicationType: 'hear_more',
      catchUpAllowed: true,
    })
    expect(['apply', 'casual_talk']).toContain(decision.recommendedAction)
    expect(decision.requirements.find((r) => r.requirement.includes('未知のフロントエンド'))?.status).not.toBe(
      'matched',
    )
    expect(decision.matchedExperiences.length).toBeGreaterThan(0)

    const provider = new FallbackAiProvider()
    const diag = await provider.diagnose({
      title,
      body,
      extraction,
      safety: [],
      effort: emptyEffort,
      profile: baseProfile,
      budgetMinYen: 200000,
      feeRatePercent: 0,
      platform: 'youtrust',
      applicationType: 'hear_more',
    })
    const parsed = DiagnosisResultSchema.safeParse(diag)
    expect(parsed.success).toBe(true)
    expect(diag.recommendedAction).toBeTruthy()

    const msg = buildYoutrustMessage({
      title,
      body,
      diagnosis: diag,
      extraction,
      profile: baseProfile,
      companyName: '架空事業会社',
    })
    const msgParsed = ProposalResultSchema.safeParse(msg)
    expect(msgParsed.success).toBe(true)
    expect(msg.body.length).toBeLessThanOrEqual(200)
    expect(msg.body).toMatch(/Web|要件|業務|改善|ヒアリング|サービス/)
    expect(msg.body).not.toMatch(/強く惹かれました$/)
    expect(msg.documentType).toBe('youtrust_message')
  })
})

describe('acceptance case 2: specialized SaaS ops', () => {
  const title = '顧客体験SaaS運用'
  const body = `
顧客体験改善SaaSを用いたシナリオ・条件分岐・配信運用。
当該SaaSの実装・運用経験が必須。
HTML/CSS、分析、計測設計の経験が歓迎。
月20〜60時間、フルリモート。
`.trim()

  it('marks missing SaaS experience and prefers casual_talk over apply', async () => {
    const extraction = extractionFrom({
      required: ['顧客体験改善SaaSの実装・運用経験'],
      preferred: ['HTML/CSS', '計測設計'],
      role: 'SaaS運用',
    })
    const decision = decideApplicationAction({
      title,
      body,
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'question',
      legacyReason: '要確認',
      applicationType: 'standard',
    })
    const saas = decision.requirements.find((r) => r.requirement.includes('顧客体験改善SaaS'))
    expect(saas?.status).toBe('missing')
    expect(decision.recommendedAction).toBe('casual_talk')

    const provider = new FallbackAiProvider()
    const diag = await provider.diagnose({
      title,
      body,
      extraction,
      safety: [],
      effort: emptyEffort,
      profile: baseProfile,
      budgetMinYen: null,
      feeRatePercent: 0,
      platform: 'youtrust',
      applicationType: 'standard',
    })
    const proposal = await provider.generateProposal({
      title,
      body,
      diagnosis: diag,
      extraction,
      profile: baseProfile,
      platform: 'youtrust',
    })
    expect(proposal.body.length).toBeLessThanOrEqual(200)
    expect(proposal.body).toMatch(/実務経験はありません|類似|ありませんが/)
    expect(proposal.body).not.toMatch(/顧客体験改善SaaSの実務経験があります/)
  })
})

describe('acceptance case 3: speech AI research', () => {
  const title = '音声認識モジュール研究開発'
  const body = `
音声認識・音声生成・信号処理アルゴリズムの研究開発。
音声工学、機械学習、Python、音声処理ライブラリの経験が必須。
リモート・副業可。
`.trim()

  it('detects specialized gaps and avoids high-fit from interest alone', () => {
    const extraction = extractionFrom({
      required: ['音声工学', '信号処理アルゴリズム', '音声処理ライブラリ', '機械学習'],
      preferred: ['Python'],
      role: '音声認識モジュール',
    })
    const decision = decideApplicationAction({
      title,
      body,
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'apply',
      legacyReason: '条件を満たしています',
    })
    expect(['skip', 'casual_talk']).toContain(decision.recommendedAction)
    expect(decision.applicationPriority).toBe('low')
    expect(decision.requirements.some((r) => r.requirement.includes('音声') && r.status === 'missing')).toBe(
      true,
    )
    const py = decision.requirements.find((r) => r.requirement === 'Python')
    expect(py?.status).toBe('transferable')
  })
})

describe('acceptance case 4: internal AI product', () => {
  const title = '社内業務のAI化と自社Webプロダクト'
  const body = `
社内業務の自動化、AI API連携、自社WebプロダクトへのAI機能実装。
業務フローの設計、ツール内製、データ処理。
生成AIの業務利用、Web開発、API連携経験を歓迎。
完全リモート、稼働時間は応相談。
`.trim()

  it('values API/web/process experience and keeps personal Python distinct', async () => {
    const extraction = extractionFrom({
      required: ['業務フローの設計', 'API連携', 'Web開発'],
      preferred: ['生成AIの業務利用', 'Python'],
      role: '社内業務のAI化',
    })
    const decision = decideApplicationAction({
      title,
      body,
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'apply',
      legacyReason: '条件を満たしています',
      applicationType: 'casual_talk',
      catchUpAllowed: true,
    })
    expect(['apply', 'casual_talk']).toContain(decision.recommendedAction)
    if (decision.recommendedAction === 'casual_talk') {
      expect(['high', 'medium']).toContain(decision.applicationPriority)
    }
    const py = decision.requirements.find((r) => r.requirement === 'Python')
    expect(py?.status).toBe('transferable')

    const provider = new FallbackAiProvider()
    const diag = await provider.diagnose({
      title,
      body,
      extraction,
      safety: [],
      effort: emptyEffort,
      profile: baseProfile,
      budgetMinYen: 150000,
      feeRatePercent: 0,
      platform: 'other',
      applicationType: 'casual_talk',
    })
    const proposal = await provider.generateProposal({
      title,
      body,
      diagnosis: diag,
      extraction,
      profile: baseProfile,
      platform: 'other',
      messageLength: 'short',
    })
    expect(proposal.body).toMatch(/社内|業務|AI化|API|Web/)
    expect(proposal.documentType).toBe('short_message')
  })
})

describe('acceptance case 5: full-time trial disguised as side job', () => {
  const title = '自社SaaS開発メンバー'
  const body = `
自社SaaSの開発メンバー募集。
副業での短期参画が可能。
ただし正社員採用の見極めを目的とした参画である。
高いコミットメント・速度・成果を求める。
継続副業の可否は明記なし。
`.trim()

  it('detects hiring-intent mismatch and asks about side-job continuity', () => {
    const extraction = extractionFrom({
      required: ['Web開発', 'TypeScript'],
      role: '自社SaaS開発',
    })
    const decision = decideApplicationAction({
      title,
      body,
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'apply',
      legacyReason: '条件を満たしています',
    })
    expect(['confirm_conditions', 'skip']).toContain(decision.recommendedAction)
    expect(decision.conditionRisks.some((r) => /正社員|採用/.test(r.risk))).toBe(true)
    expect(decision.questionsToConfirm.some((q) => /正社員転換を前提としない副業/.test(q))).toBe(true)
  })
})

describe('pipeline and schema compatibility', () => {
  it('allows casual_sent transitions and keeps diagnosis schema backward compatible', () => {
    expect(canTransition('review', 'casual_sent')).toBe(true)
    expect(canTransition('casual_sent', 'replied')).toBe(true)
    const minimal = DiagnosisResultSchema.safeParse({
      axes: [
        {
          axis: 'safety',
          rating: 'good',
          facts: [],
          reason: 'ok',
          missing: [],
        },
      ],
      recommendation: 'apply',
      recommendationReason: 'ok',
      preQuestions: [],
      scopeIn: [],
      scopeOut: [],
    })
    expect(minimal.success).toBe(true)
  })

  it('normalizes legacy profiles without interestAreas', () => {
    const p = normalizeProfile({ name: '旧ユーザー', skills: [] } as Partial<UserProfile>)
    expect(p.interestAreas.technologies).toEqual([])
  })
})

describe('common message quality', () => {
  it('keeps YouTrust message within 200 chars including punctuation', () => {
    const extraction = extractionFrom({
      required: ['要件整理'],
      role: '倉庫オペレーション改善',
    })
    const decision = decideApplicationAction({
      title: '倉庫オペレーション改善',
      body: '倉庫オペレーションの可視化と改善。要件整理歓迎。',
      profile: baseProfile,
      extraction,
      legacyRecommendation: 'apply',
      legacyReason: 'ok',
    })
    const msg = buildYoutrustMessage({
      title: '倉庫オペレーション改善',
      body: '倉庫オペレーションの可視化と改善。',
      diagnosis: {
        axes: [],
        recommendation: 'apply',
        recommendationReason: 'ok',
        preQuestions: [],
        scopeIn: [],
        scopeOut: [],
        ...decision,
        existingLabel: decision.judgmentLabel,
        decisionReason: decision.decisionReason,
      },
      extraction,
      profile: baseProfile,
    })
    expect(msg.body.length).toBeLessThanOrEqual(200)
    expect(msg.messageCharacterCount).toBe(msg.body.length)
    expect(msg.body).toContain('倉庫オペレーション')
  })
})
