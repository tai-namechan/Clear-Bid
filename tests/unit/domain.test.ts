import { describe, expect, it } from 'vitest'
import {
  applyBuffer,
  effectiveHourlyYen,
  hoursToMinutes,
  preTaxTakeHome,
  sumEffortHours,
} from '../../server/domain/money'
import { decideRecommendation } from '../../server/domain/recommendation'
import { runSafetyRules } from '../../server/rules/engine'
import { INIT_PROFILE } from '../../shared/types'
import type { EffortEstimate, ExtractionResult, SafetyFinding } from '../../shared/schemas/ai'

describe('money domain', () => {
  it('converts hours to minutes as integers', () => {
    expect(hoursToMinutes(1.5)).toBe(90)
  })

  it('calculates pre-tax take-home after fee', () => {
    expect(preTaxTakeHome({ contractYen: 100000, feeRatePercent: 20 })).toBe(80000)
  })

  it('calculates effective hourly rate', () => {
    expect(effectiveHourlyYen(80000, 20)).toBe(4000)
  })

  it('applies buffer without double-counting in helper', () => {
    expect(applyBuffer(10, 0.2)).toBe(12)
  })

  it('sums effort tasks', () => {
    expect(
      sumEffortHours([
        { category: '実装', min: 2, likely: 4, max: 8, assumption: '' },
        { category: 'テスト', min: 1, likely: 2, max: 3, assumption: '' },
      ]),
    ).toEqual({ min: 3, likely: 6, max: 11 })
  })
})

describe('safety rules', () => {
  it('detects PAY-01 with quote from source text', () => {
    const findings = runSafetyRules({
      title: '急募',
      body: '仮払い前に作業を開始してください。すぐに着手できる方。',
      budgetMin: '50000',
      clientRating: '4.8',
      clientOrders: '10',
    })
    const pay01 = findings.find((f) => f.ruleId === 'PAY-01')
    expect(pay01?.classification).toBe('BLOCK')
    expect(pay01?.quote).toBeTruthy()
  })

  it('does not invent BLOCK without matching text', () => {
    const findings = runSafetyRules({
      title: 'Laravel改修',
      body: '既存の管理画面を改修します。予算は応相談。納期は相談。',
      budgetMin: '',
      clientOrders: '3',
    })
    expect(findings.every((f) => f.classification !== 'BLOCK' || f.quote)).toBe(true)
    expect(findings.some((f) => f.ruleId === 'BUD-01')).toBe(true)
  })
})

describe('recommendation rules', () => {
  const effort: EffortEstimate = {
    tasks: [
      { category: '実装', min: 5, likely: 10, max: 15, assumption: '' },
      { category: 'テスト', min: 1, likely: 2, max: 4, assumption: '' },
    ],
    bufferRate: 0.2,
    bufferReason: '20%',
  }
  const extraction: ExtractionResult = {
    deliverables: [{ text: '管理画面', provenance: 'confirmed', quote: '管理画面' }],
    requiredSkills: [{ text: 'Laravel', provenance: 'confirmed', quote: 'Laravel' }],
    unknowns: [],
  }

  it('skips when open BLOCK exists', () => {
    const safety: SafetyFinding[] = [
      {
        ruleId: 'PAY-01',
        ruleVersion: 1,
        classification: 'BLOCK',
        source: 'rule',
        quote: '仮払い前に作業',
        reason: '危険',
        confidence: 'high',
        status: 'open',
        userNote: null,
      },
    ]
    const r = decideRecommendation({
      safety,
      effort,
      extraction,
      profile: { ...INIT_PROFILE, skills: [{ name: 'Laravel', level: '実務' }] },
      budgetMinYen: 100000,
      feeRatePercent: 20,
    })
    expect(r.recommendation).toBe('skip')
  })

  it('suggests question when checks remain', () => {
    const safety: SafetyFinding[] = [
      {
        ruleId: 'SCP-04',
        ruleVersion: 1,
        classification: 'CHECK',
        source: 'rule',
        quote: '開発一式',
        reason: '一式で不明',
        confidence: 'high',
        status: 'open',
        userNote: null,
      },
    ]
    const r = decideRecommendation({
      safety,
      effort,
      extraction,
      profile: { ...INIT_PROFILE, skills: [{ name: 'Laravel', level: '実務' }], weeklyHours: 20 },
      budgetMinYen: 200000,
      feeRatePercent: 20,
      deadlineDays: 30,
    })
    expect(r.recommendation).toBe('question')
  })
})
