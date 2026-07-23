import { describe, expect, it } from 'vitest'
import { decideRecommendation } from '../../server/domain/recommendation'
import { INIT_PROFILE } from '../../shared/types'
import type { EffortEstimate, ExtractionResult, SafetyFinding } from '../../shared/schemas/ai'

const effort: EffortEstimate = {
  tasks: [{ category: '実装', min: 5, likely: 10, max: 12, assumption: '' }],
  bufferRate: 0.2,
  bufferReason: '20%',
}
const extraction: ExtractionResult = {
  deliverables: [{ text: 'API', provenance: 'confirmed', quote: 'API' }],
  requiredSkills: [{ text: 'Laravel', provenance: 'confirmed', quote: 'Laravel' }],
  unknowns: [],
}

describe('phase2 judgment rules', () => {
  it('ignores resolved BLOCK when deciding recommendation', () => {
    const safety: SafetyFinding[] = [
      {
        ruleId: 'PAY-01',
        ruleVersion: 1,
        classification: 'BLOCK',
        source: 'rule',
        quote: '仮払い前',
        reason: '危険',
        confidence: 'high',
        status: 'resolved',
        userNote: '誤検知',
        resolveReason: '誤検知',
      },
    ]
    const r = decideRecommendation({
      safety: safety.filter((s) => s.status === 'open'),
      effort,
      extraction,
      profile: { ...INIT_PROFILE, skills: [{ name: 'Laravel', level: '実務' }], weeklyHours: 20 },
      budgetMinYen: 200000,
      feeRatePercent: 20,
      deadlineDays: 30,
    })
    expect(r.recommendation).not.toBe('skip')
  })
})
