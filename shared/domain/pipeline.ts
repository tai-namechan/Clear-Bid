import type { StatusCode } from '../types'
import type { Opportunity } from '../opportunity'
import { SKIP_REASONS } from '../constants'

/** Allowed flexible transitions (spec §5.2). Append-only events; no silent rewind. */
const ALLOWED: Record<StatusCode, StatusCode[]> = {
  draft: ['extracted', 'skipped', 'cancelled'],
  extracted: ['diagnosing', 'review', 'skipped'],
  diagnosing: ['review', 'skipped'],
  review: ['needs_question', 'skipped', 'applied'],
  needs_question: ['review', 'skipped', 'applied'],
  skipped: [],
  applied: ['replied', 'interview', 'won', 'lost', 'cancelled'],
  replied: ['interview', 'won', 'lost', 'needs_question', 'cancelled'],
  interview: ['won', 'lost', 'cancelled'],
  won: ['working', 'delivered', 'cancelled'],
  working: ['delivered', 'completed', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: ['paid'],
  paid: [],
  lost: [],
  cancelled: [],
}

export function canTransition(from: StatusCode, to: StatusCode): boolean {
  if (from === to) return false
  return (ALLOWED[from] || []).includes(to)
}

export function nextStatuses(from: StatusCode): StatusCode[] {
  return ALLOWED[from] || []
}

export function requiresReason(to: StatusCode): boolean {
  return to === 'skipped' || to === 'lost' || to === 'cancelled'
}

export function isValidReasonCode(code: string): boolean {
  return (SKIP_REASONS as readonly string[]).includes(code)
}

export function totalWorkMinutes(opp: Opportunity): number {
  return (opp.workLogs || []).reduce((s, w) => s + (w.minutes || 0), 0)
}

export function effortVarianceRate(opp: Opportunity): number | null {
  const actualH = totalWorkMinutes(opp) / 60
  const likely = opp.estimatedLikelyHours
  if (!likely || likely <= 0 || actualH <= 0) return null
  return (actualH - likely) / likely
}

export function actualHourlyYen(opp: Opportunity): number | null {
  const take = opp.financial?.preTaxTakeHomeYen
  const minutes = totalWorkMinutes(opp)
  if (take == null || take <= 0 || minutes <= 0) return null
  return Math.round(take / (minutes / 60))
}

export type NextAction =
  | { type: 'diagnose'; label: string }
  | { type: 'reply_wait'; label: string; opportunityId: string; title: string }
  | { type: 'record_result'; label: string; opportunityId: string; title: string }
  | { type: 'log_work'; label: string; opportunityId: string; title: string }
  | { type: 'record_payment'; label: string; opportunityId: string; title: string }

export function buildNextActions(items: Opportunity[]): NextAction[] {
  const actions: NextAction[] = []
  for (const it of items) {
    if (it.status === 'applied') {
      actions.push({
        type: 'reply_wait',
        label: '返信結果を記録',
        opportunityId: it.id,
        title: it.title,
      })
    } else if (it.status === 'replied' || it.status === 'interview') {
      actions.push({
        type: 'record_result',
        label: '受注/失注を記録',
        opportunityId: it.id,
        title: it.title,
      })
    } else if (it.status === 'won' || it.status === 'working' || it.status === 'delivered') {
      actions.push({
        type: 'log_work',
        label: '作業時間を記録',
        opportunityId: it.id,
        title: it.title,
      })
    } else if (it.status === 'completed' && !it.financial?.paidAt) {
      actions.push({
        type: 'record_payment',
        label: '入金を記録',
        opportunityId: it.id,
        title: it.title,
      })
    }
  }
  return actions.slice(0, 5)
}
