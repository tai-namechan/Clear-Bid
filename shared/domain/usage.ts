export type AiOperation = 'extract' | 'diagnose' | 'proposal' | 'reply' | 'safety'

export interface AiUsageState {
  period: string
  counts: Record<string, number>
  failedCounts: Record<string, number>
}

export function currentPeriod(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function emptyUsage(period = currentPeriod()): AiUsageState {
  return { period, counts: {}, failedCounts: {} }
}

export function canUse(usage: AiUsageState, op: AiOperation, limit: number): boolean {
  if (usage.period !== currentPeriod()) return true
  return (usage.counts[op] || 0) < limit
}

export function recordSuccess(usage: AiUsageState, op: AiOperation): AiUsageState {
  const period = currentPeriod()
  const base = usage.period === period ? usage : emptyUsage(period)
  return {
    ...base,
    counts: { ...base.counts, [op]: (base.counts[op] || 0) + 1 },
  }
}

export function recordFailure(usage: AiUsageState, op: AiOperation): AiUsageState {
  const period = currentPeriod()
  const base = usage.period === period ? usage : emptyUsage(period)
  return {
    ...base,
    failedCounts: { ...base.failedCounts, [op]: (base.failedCounts[op] || 0) + 1 },
  }
}
