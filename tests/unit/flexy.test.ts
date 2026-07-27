import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FEE_RATES, PLATFORMS } from '../../shared/constants'
import {
  availableMonthlyHours,
  extractFlexyHeuristics,
  hasMonthlyHoursMention,
  initRequirementEvidences,
  parseFlexyBudget,
  parseFlexyWorkDays,
  resolveJobFeeRate,
  safeMonthlyEffectiveHourly,
  splitAtomicRequirements,
  suggestEvidenceStatus,
} from '../../shared/domain/flexy'
import { ExtractionResultSchema, ProposalResultSchema } from '../../shared/schemas/ai'
import {
  INIT_PROFILE,
  normalizeJobInput,
  normalizeProfile,
} from '../../shared/types'
import { decideRecommendation } from '../../server/domain/recommendation'
import { buildFlexyInterestMessage } from '../../server/ai/flexyMessage'
import { FallbackAiProvider, getAiProvider } from '../../server/ai/provider'
import type { EffortEstimate, ExtractionResult, SafetyFinding } from '../../shared/schemas/ai'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/flexy-job.txt')
const FLEXY_FIXTURE = readFileSync(fixturePath, 'utf8')

const emptyEffort: EffortEstimate = {
  tasks: [{ category: '継続稼働', min: 0, likely: 0, max: 0, assumption: '月額継続' }],
  bufferRate: 0,
  bufferReason: '',
}

describe('FLEXY platform constants', () => {
  it('exposes FLEXY in platforms with 0% default fee', () => {
    expect(PLATFORMS.flexy).toBe('FLEXY')
    expect(DEFAULT_FEE_RATES.flexy).toBe(0)
  })

  it('prefers job fee override over platform default and profile', () => {
    expect(
      resolveJobFeeRate({ platform: 'flexy', jobFeeRatePercent: '', profileFeeRate: 20 }),
    ).toBe(0)
    expect(
      resolveJobFeeRate({ platform: 'flexy', jobFeeRatePercent: '5', profileFeeRate: 20 }),
    ).toBe(5)
    expect(
      resolveJobFeeRate({ platform: 'crowdworks', jobFeeRatePercent: '', profileFeeRate: 18 }),
    ).toBe(18)
  })
})

describe('FLEXY notation parser', () => {
  it('parses upper-only monthly budget without treating it as minimum', () => {
    const r = parseFlexyBudget('報酬：〜72万円／月')
    expect(r.budgetType).toBe('monthly')
    expect(r.budgetMaxYen).toBe(720000)
    expect(r.budgetMinYen).toBeNull()
  })

  it('parses monthly budget range', () => {
    const r = parseFlexyBudget('報酬：40〜60万円/月')
    expect(r.budgetMinYen).toBe(400000)
    expect(r.budgetMaxYen).toBe(600000)
  })

  it('parses work days without inventing monthly hours', () => {
    expect(parseFlexyWorkDays('稼働日数：週5日')?.workDaysText).toBe('週5日')
    expect(parseFlexyWorkDays('週2〜3日')?.minDays).toBe(2)
    expect(parseFlexyWorkDays('週2〜3日')?.maxDays).toBe(3)
    expect(hasMonthlyHoursMention('稼働日数：週5日、ビジネスタイム以外の空き時間')).toBe(false)
  })

  it('splits compound LLM/RAG requirements atomically', () => {
    const parts = splitAtomicRequirements(
      'LLM API・RAG・構造化出力を活用した機能の構築経験',
    )
    expect(parts.length).toBe(3)
    expect(parts.some((p) => p.includes('LLM API'))).toBe(true)
    expect(parts.some((p) => p.includes('RAG'))).toBe(true)
    expect(parts.some((p) => p.includes('構造化出力'))).toBe(true)
  })
})

describe('FLEXY extraction heuristics (AC2)', () => {
  it('extracts role, work days, availability, remote, requirements, unknown monthly hours', () => {
    const title = 'DX推進におけるPM支援（フルリモート）'
    const r = extractFlexyHeuristics(title, FLEXY_FIXTURE)
    expect(r.role?.text).toContain('AIオペレーションマネジャー')
    expect(r.workDays?.text).toContain('週5日')
    expect(r.requiredAvailability?.text).toMatch(/ビジネスタイム以外/)
    expect(r.workStyle?.text).toMatch(/リモート/)
    expect(r.requiredRequirements?.length).toBeGreaterThan(5)
    expect(r.unknowns).toContain('月間稼働時間')
    const budget = parseFlexyBudget(FLEXY_FIXTURE)
    expect(budget.budgetMaxYen).toBe(720000)
    expect(budget.budgetMinYen).toBeNull()
  })
})

describe('FLEXY profitability / feasibility (AC3/AC4)', () => {
  it('does not convert 週5日 into 160 monthly hours', () => {
    const avail = availableMonthlyHours(10)
    expect(avail).toBe(Math.round(((10 * 52) / 12) * 10) / 10)
    expect(avail).not.toBe(160)
    const decision = decideRecommendation({
      safety: [],
      effort: emptyEffort,
      extraction: {
        deliverables: [],
        requiredSkills: [],
        unknowns: ['月間稼働時間'],
        requiredRequirements: [],
        preferredRequirements: [],
        workDays: { text: '週5日', provenance: 'confirmed', quote: '週5日' },
      },
      profile: { ...INIT_PROFILE, weeklyHours: 10 },
      budgetMinYen: null,
      budgetMaxYen: 720000,
      feeRatePercent: 0,
      engagementType: 'ongoing',
      budgetType: 'monthly',
      expectedMonthlyHoursMin: '',
      expectedMonthlyHoursMax: '',
      requirementEvidences: [],
    })
    expect(decision.recommendation).toBe('question')
    expect(decision.safeHourly).toBeNull()
    expect(decision.consultantQuestions.some((q) => /月間稼働時間/.test(q))).toBe(true)
  })

  it('does not compute safe hourly from upper-only monthly budget', () => {
    expect(
      safeMonthlyEffectiveHourly({
        budgetMinYen: null,
        monthlyHoursMax: 80,
        feeRatePercent: 0,
      }),
    ).toBeNull()
    const decision = decideRecommendation({
      safety: [],
      effort: emptyEffort,
      extraction: { deliverables: [], requiredSkills: [], unknowns: [], requiredRequirements: [], preferredRequirements: [] },
      profile: { ...INIT_PROFILE, weeklyHours: 20, minHourlyYen: 2000 },
      budgetMinYen: null,
      budgetMaxYen: 720000,
      feeRatePercent: 0,
      engagementType: 'ongoing',
      budgetType: 'monthly',
      expectedMonthlyHoursMin: '40',
      expectedMonthlyHoursMax: '80',
      requirementEvidences: [],
    })
    expect(decision.safeHourly).toBeNull()
  })
})

describe('requirement evidence (AC5)', () => {
  it('does not treat LLM API skill as RAG match', () => {
    const profile = {
      ...INIT_PROFILE,
      skills: [{ name: 'LLM API', level: '実務' as const }],
    }
    const rag = suggestEvidenceStatus('RAGを活用した機能の構築経験', profile)
    expect(rag.status).not.toBe('supported')
    const llm = suggestEvidenceStatus('LLM APIを活用した機能の構築経験', profile)
    // auto-init demotes supported→partial for human confirmation
    const evidences = initRequirementEvidences(
      [
        { text: 'LLM APIを活用した機能の構築経験', quote: 'LLM API' },
        { text: 'RAGを活用した機能の構築経験', quote: 'RAG' },
      ],
      profile,
    )
    expect(evidences.find((e) => e.requirement.includes('RAG'))?.status).toBe('unverified')
    expect(evidences.find((e) => e.requirement.includes('LLM API'))?.status).toBe('partial')
    expect(llm.status === 'supported' || llm.status === 'partial').toBe(true)
  })
})

describe('unsupported requirement recommendation', () => {
  it('skips when a required evidence is unsupported', () => {
    const decision = decideRecommendation({
      safety: [] as SafetyFinding[],
      effort: emptyEffort,
      extraction: {
        deliverables: [],
        requiredSkills: [],
        unknowns: [],
        requiredRequirements: [{ text: 'RAG', provenance: 'confirmed', quote: 'RAG' }],
        preferredRequirements: [],
      },
      profile: { ...INIT_PROFILE, weeklyHours: 20 },
      budgetMinYen: 400000,
      feeRatePercent: 0,
      engagementType: 'ongoing',
      budgetType: 'monthly',
      expectedMonthlyHoursMin: '40',
      expectedMonthlyHoursMax: '60',
      requirementEvidences: [
        {
          requirement: 'RAG',
          status: 'unsupported',
          evidenceNote: '',
          sourceQuote: 'RAG',
        },
      ],
    })
    expect(decision.recommendation).toBe('skip')
  })
})

describe('FLEXY interest message fallback (AC7/AC8)', () => {
  it('returns interest_message and never claims unverified RAG experience', async () => {
    const provider = new FallbackAiProvider()
    const extraction = extractFlexyHeuristics('DX推進におけるPM支援（フルリモート）', FLEXY_FIXTURE)
    const parsed = ExtractionResultSchema.parse({
      deliverables: [],
      requiredSkills: extraction.requiredSkills || [],
      unknowns: extraction.unknowns || [],
      ...extraction,
    })
    const result = await provider.generateProposal({
      title: 'DX推進におけるPM支援（フルリモート）',
      platform: 'flexy',
      jobUrl: 'https://example.com/jobs/1',
      diagnosis: {
        axes: [],
        recommendation: 'question',
        recommendationReason: '確認事項あり',
        preQuestions: ['想定月間稼働時間を教えてください'],
        scopeIn: [],
        scopeOut: [],
      },
      extraction: parsed,
      profile: { ...INIT_PROFILE, name: 'テスト', weeklyHours: 10 },
      requirementEvidences: [
        {
          requirement: 'LLM APIを活用した機能の構築経験',
          status: 'supported',
          evidenceNote: '社内ツールでOpenAI API連携を実装',
          sourceQuote: 'LLM API',
        },
        {
          requirement: 'RAGを活用した機能の構築経験',
          status: 'unsupported',
          evidenceNote: '',
          sourceQuote: 'RAG',
        },
        {
          requirement: '構造化出力を活用した機能の構築経験',
          status: 'unverified',
          evidenceNote: '',
          sourceQuote: '構造化出力',
        },
      ],
      consultantQuestions: ['日中MTGの要否を確認してください'],
    })
    const ok = ProposalResultSchema.safeParse(result)
    expect(ok.success).toBe(true)
    expect(result.documentType).toBe('interest_message')
    expect(result.body).toContain('FLEXYご担当者様')
    expect(result.body).toContain('社内ツールでOpenAI API連携を実装')
    expect(result.body).not.toMatch(/RAG.*経験があります/)
    expect(result.body).not.toContain('構造化出力の経験があります')
    expect(result.body).toContain('https://example.com/jobs/1')
  })

  it('buildFlexyInterestMessage is a single draft', () => {
    const msg = buildFlexyInterestMessage({
      title: '案件A',
      diagnosis: {
        axes: [],
        recommendation: 'apply',
        recommendationReason: 'ok',
        preQuestions: [],
        scopeIn: [],
        scopeOut: [],
      },
      extraction: {
        deliverables: [],
        requiredSkills: [],
        unknowns: [],
        requiredRequirements: [],
        preferredRequirements: [],
        role: { text: 'AIオペレーションマネジャー', provenance: 'confirmed', quote: '' },
      },
      profile: { ...INIT_PROFILE, name: '山田' },
      requirementEvidences: [
        {
          requirement: 'Git',
          status: 'supported',
          evidenceNote: 'GitHub Flowで運用',
          sourceQuote: 'Git',
        },
      ],
    })
    expect(msg.documentType).toBe('interest_message')
    expect(msg.body.split('FLEXYご担当者様').length - 1).toBe(1)
  })
})

describe('backward compatibility normalize (AC10)', () => {
  it('normalizes legacy profile without new fields', () => {
    const p = normalizeProfile({
      name: '旧ユーザー',
      weeklyHours: 8,
      feeRate: 22,
      platform: 'crowdworks',
    } as Partial<typeof INIT_PROFILE>)
    expect(p.name).toBe('旧ユーザー')
    expect(p.skills).toEqual([])
    expect(p.achievements).toEqual([])
    expect(p.platform).toBe('crowdworks')
  })

  it('normalizes legacy job input and fills FLEXY defaults', () => {
    const j = normalizeJobInput({
      platform: 'flexy',
      title: '旧案件',
      body: '本文',
      budgetType: 'monthly',
    })
    expect(j.engagementType).toBe('ongoing')
    expect(j.expectedMonthlyHoursMin).toBe('')
    expect(j.feeRatePercent).toBe('')
    expect(j.url).toBe('')
  })
})

describe('CrowdWorks regression (AC9)', () => {
  it('keeps project recommendation path for fixed budget jobs', () => {
    const extraction: ExtractionResult = {
      deliverables: [{ text: '管理画面', provenance: 'confirmed', quote: '管理画面' }],
      requiredSkills: [{ text: 'Laravel', provenance: 'confirmed', quote: 'Laravel' }],
      unknowns: [],
      requiredRequirements: [],
      preferredRequirements: [],
    }
    const r = decideRecommendation({
      safety: [],
      effort: {
        tasks: [{ category: '実装', min: 5, likely: 10, max: 12, assumption: '' }],
        bufferRate: 0.2,
        bufferReason: '20%',
      },
      extraction,
      profile: { ...INIT_PROFILE, skills: [{ name: 'Laravel', level: '実務' }], weeklyHours: 20 },
      budgetMinYen: 200000,
      feeRatePercent: 20,
      deadlineDays: 30,
      engagementType: 'project',
      budgetType: 'fixed',
    })
    expect(r.recommendation).toBe('apply')
    expect(r.safeHourly).not.toBeNull()
  })

  it('fallback proposal stays documentType proposal for crowdworks', async () => {
    const provider = getAiProvider()
    const result = await provider.generateProposal({
      title: 'Laravel改修',
      platform: 'crowdworks',
      diagnosis: {
        axes: [],
        recommendation: 'apply',
        recommendationReason: '条件充足',
        preQuestions: [],
        scopeIn: ['管理画面'],
        scopeOut: [],
      },
      extraction: {
        deliverables: [{ text: '管理画面', provenance: 'confirmed', quote: '管理画面' }],
        requiredSkills: [],
        unknowns: [],
        requiredRequirements: [],
        preferredRequirements: [],
      },
      profile: { ...INIT_PROFILE, name: '佐藤' },
    })
    expect(result.documentType).toBe('proposal')
    expect(result.body).toContain('佐藤')
    expect(result.body).not.toContain('FLEXYご担当者様')
  })
})
