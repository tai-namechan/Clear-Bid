import type { EffortEstimate, EffortTask } from '../../shared/schemas/ai'

/** Amounts are integers in yen. Hours are decimal hours for UI; minutes for persistence. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

export function sumEffortHours(tasks: EffortTask[]) {
  return {
    min: tasks.reduce((s, t) => s + t.min, 0),
    likely: tasks.reduce((s, t) => s + t.likely, 0),
    max: tasks.reduce((s, t) => s + t.max, 0),
  }
}

export function applyBuffer(likelyHours: number, bufferRate: number): number {
  return Math.round(likelyHours * (1 + bufferRate) * 10) / 10
}

export function preTaxTakeHome(params: {
  contractYen: number
  feeRatePercent: number
  expenseYen?: number
  withholdingYen?: number
}): number {
  const fee = Math.floor((params.contractYen * params.feeRatePercent) / 100)
  const take =
    params.contractYen - fee - (params.expenseYen || 0) - (params.withholdingYen || 0)
  return Math.max(0, take)
}

export function effectiveHourlyYen(takeHomeYen: number, hours: number): number | null {
  if (hours <= 0) return null
  return Math.round(takeHomeYen / hours)
}

export function availableHoursUntilDeadline(params: {
  weeklyHours: number
  deadlineDays?: number | null
  reservedHours?: number
  mtgHours?: number
}): number | null {
  if (!params.deadlineDays || params.deadlineDays <= 0) return null
  const weeks = params.deadlineDays / 7
  const gross = params.weeklyHours * weeks
  return Math.max(0, Math.round((gross - (params.reservedHours || 0) - (params.mtgHours || 0)) * 10) / 10)
}

export function estimateEffortHeuristic(body: string, title: string): EffortEstimate {
  const text = `${title}\n${body}`
  const len = text.length
  const isExisting = /既存|改修|リプレイス|移行/.test(text)
  const isVague = /お任せ|いい感じ|一式/.test(text)
  const hasUi = /UI|画面|デザイン|フロント/.test(text)
  const complexity = len > 800 ? 1.4 : len > 400 ? 1.1 : 0.85

  const tasks: EffortTask[] = [
    { category: '要件確認', min: 1, likely: 2, max: 4, assumption: '募集文ベースの確認' },
    {
      category: '調査・既存仕様把握',
      min: isExisting ? 2 : 0.5,
      likely: isExisting ? 4 : 1,
      max: isExisting ? 8 : 2,
      assumption: isExisting ? '既存システム調査が必要' : '新規想定',
    },
    { category: '設計', min: 1, likely: 2 * complexity, max: 4 * complexity, assumption: '' },
    {
      category: 'UI・デザイン',
      min: hasUi ? 2 : 0,
      likely: hasUi ? 4 : 0,
      max: hasUi ? 8 : 0,
      assumption: hasUi ? '画面作業あり' : '対象外の可能性',
    },
    {
      category: '実装',
      min: 4 * complexity,
      likely: 10 * complexity,
      max: 20 * complexity,
      assumption: '主要機能の実装',
    },
    { category: 'テスト', min: 1, likely: 3, max: 6, assumption: '' },
    { category: 'MTG・連絡', min: 1, likely: 2, max: 4, assumption: '週1想定' },
    { category: '修正対応', min: 1, likely: 3, max: 6, assumption: '修正回数未確定' },
  ].map((t) => ({
    ...t,
    min: Math.round(t.min * 10) / 10,
    likely: Math.round(t.likely * 10) / 10,
    max: Math.round(t.max * 10) / 10,
  }))

  const bufferRate = isExisting ? 0.3 : isVague ? 0.4 : 0.2
  const bufferReason = isExisting
    ? '既存改修のため30%'
    : isVague
      ? '仕様が不明瞭なため40%'
      : '要件が比較的明確なため20%'

  return { tasks: tasks.filter((t) => t.max > 0), bufferRate, bufferReason }
}

export function effortVarianceRate(actualHours: number, likelyHours: number): number | null {
  if (likelyHours <= 0) return null
  return (actualHours - likelyHours) / likelyHours
}
