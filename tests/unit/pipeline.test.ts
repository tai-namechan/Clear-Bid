import { describe, expect, it } from 'vitest'
import { calcFinancial } from '../../shared/domain/financial'
import { canTransition, requiresReason, nextStatuses } from '../../shared/domain/pipeline'

describe('financial', () => {
  it('calculates fee and pre-tax take-home as integers', () => {
    expect(calcFinancial({ contractYen: 100000, feeRatePercent: 20 })).toEqual({
      contractYen: 100000,
      feeYen: 20000,
      withholdingYen: 0,
      expenseYen: 0,
      preTaxTakeHomeYen: 80000,
    })
  })
})

describe('pipeline transitions', () => {
  it('allows applied -> won without interview', () => {
    expect(canTransition('applied', 'won')).toBe(true)
  })

  it('allows won -> delivered without working', () => {
    expect(canTransition('won', 'delivered')).toBe(true)
  })

  it('requires reason for skipped/lost/cancelled', () => {
    expect(requiresReason('skipped')).toBe(true)
    expect(requiresReason('lost')).toBe(true)
    expect(requiresReason('applied')).toBe(false)
  })

  it('has no next statuses from paid', () => {
    expect(nextStatuses('paid')).toEqual([])
  })
})
