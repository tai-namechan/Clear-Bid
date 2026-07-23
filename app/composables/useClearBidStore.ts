import { ulid } from 'ulid'
import { AI_USAGE_LIMITS, STORAGE_KEYS } from '#shared/constants'
import { calcFinancial } from '#shared/domain/financial'
import { canTransition, requiresReason, isValidReasonCode } from '#shared/domain/pipeline'
import {
  canUse,
  emptyUsage,
  recordFailure,
  recordSuccess,
  type AiOperation,
  type AiUsageState,
} from '#shared/domain/usage'
import {
  INIT_PROFILE,
  INIT_STATS,
  type AppStats,
  type PipelineItem,
  type StatusCode,
  type UserProfile,
} from '#shared/types'
import {
  normalizeOpportunity,
  type FinancialResult,
  type Opportunity,
  type ReplyRecord,
  type WorkLog,
} from '#shared/opportunity'

async function load<T>(key: string, fallback: T): Promise<T> {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

async function save<T>(key: string, value: T): Promise<void> {
  if (!import.meta.client) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(e)
  }
}

function recomputeStats(items: Opportunity[], base?: AppStats): AppStats {
  const s: AppStats = {
    diagnosed: base?.diagnosed || 0,
    applied: 0,
    replied: 0,
    interviews: 0,
    won: 0,
    completed: 0,
    paid: 0,
    skipped: 0,
    contractTotal: 0,
    paidTotal: 0,
  }
  for (const it of items) {
    if (['applied', 'replied', 'interview', 'won', 'working', 'delivered', 'completed', 'paid', 'lost'].includes(it.status)) {
      s.applied += 1
    }
    if (['replied', 'interview', 'won', 'working', 'delivered', 'completed', 'paid'].includes(it.status)) s.replied += 1
    if (['interview', 'won', 'working', 'delivered', 'completed', 'paid'].includes(it.status)) s.interviews += 1
    if (['won', 'working', 'delivered', 'completed', 'paid'].includes(it.status)) s.won += 1
    if (['completed', 'paid'].includes(it.status)) s.completed += 1
    if (it.status === 'paid') s.paid += 1
    if (it.status === 'skipped') s.skipped += 1
    if (it.financial?.contractYen) s.contractTotal += it.financial.preTaxTakeHomeYen || 0
    if (it.financial?.paidAt) s.paidTotal += it.financial.preTaxTakeHomeYen || 0
  }
  return s
}

export function useClearBidStore() {
  const profile = useState<UserProfile>('cb-profile', () => ({ ...INIT_PROFILE }))
  const pipeline = useState<Opportunity[]>('cb-pipeline', () => [])
  const stats = useState<AppStats>('cb-stats', () => ({ ...INIT_STATS }))
  const usage = useState<AiUsageState>('cb-usage', () => emptyUsage())
  const ready = useState<boolean>('cb-ready', () => false)

  const init = async () => {
    if (ready.value) return
    profile.value = await load(STORAGE_KEYS.PROFILE, { ...INIT_PROFILE })
    const raw = await load<Partial<Opportunity>[]>(STORAGE_KEYS.PIPELINE, [])
    pipeline.value = raw.map((r) =>
      normalizeOpportunity({
        id: r.id || ulid(),
        title: r.title || '無題',
        platform: (r.platform as Opportunity['platform']) || 'crowdworks',
        status: (r.status as StatusCode) || 'draft',
        date: r.date || new Date().toISOString().slice(0, 10),
        ...r,
      }),
    )
    const loadedStats = await load(STORAGE_KEYS.STATS, { ...INIT_STATS })
    stats.value = { ...recomputeStats(pipeline.value, loadedStats), diagnosed: loadedStats.diagnosed || 0 }
    usage.value = await load(STORAGE_KEYS.AI_USAGE, emptyUsage())
    ready.value = true
  }

  const persistPipeline = async (items: Opportunity[]) => {
    pipeline.value = items
    await save(STORAGE_KEYS.PIPELINE, items)
    const next = recomputeStats(items, stats.value)
    stats.value = next
    await save(STORAGE_KEYS.STATS, next)
  }

  const saveProfile = async (p: UserProfile) => {
    profile.value = p
    await save(STORAGE_KEYS.PROFILE, p)
  }

  const savePipeline = async (items: PipelineItem[]) => {
    await persistPipeline(items.map((i) => normalizeOpportunity(i)))
  }

  const saveStats = async (s: AppStats) => {
    stats.value = s
    await save(STORAGE_KEYS.STATS, s)
  }

  const persistUsage = async (u: AiUsageState) => {
    usage.value = u
    await save(STORAGE_KEYS.AI_USAGE, u)
  }

  const assertAiBudget = (op: AiOperation) => {
    const limit = AI_USAGE_LIMITS[op as keyof typeof AI_USAGE_LIMITS]
    if (limit != null && !canUse(usage.value, op, limit)) {
      throw new Error(`今月のAI利用上限（${op}: ${limit}回）に達しました`)
    }
  }

  const trackAiSuccess = async (op: AiOperation) => {
    await persistUsage(recordSuccess(usage.value, op))
  }

  const trackAiFailure = async (op: AiOperation) => {
    await persistUsage(recordFailure(usage.value, op))
  }

  const getOpportunity = (id: string) => pipeline.value.find((p) => p.id === id)

  const upsertOpportunity = async (item: Opportunity) => {
    const exists = pipeline.value.some((p) => p.id === item.id)
    const next = exists
      ? pipeline.value.map((p) => (p.id === item.id ? item : p))
      : [item, ...pipeline.value]
    await persistPipeline(next)
  }

  const addStatusEvent = async (
    id: string,
    toStatus: StatusCode,
    opts?: { reasonCode?: string; note?: string },
  ) => {
    const item = getOpportunity(id)
    if (!item) throw new Error('案件が見つかりません')
    if (!canTransition(item.status, toStatus)) {
      throw new Error(`${item.status} から ${toStatus} へは遷移できません`)
    }
    if (requiresReason(toStatus)) {
      if (!opts?.reasonCode || !isValidReasonCode(opts.reasonCode)) {
        throw new Error('見送り・失注・キャンセルには理由が必要です')
      }
    }
    const now = new Date().toISOString()
    const updated: Opportunity = {
      ...item,
      status: toStatus,
      updatedAt: now.slice(0, 10),
      skipReason: requiresReason(toStatus) ? opts?.reasonCode : item.skipReason,
      events: [
        {
          id: ulid(),
          fromStatus: item.status,
          toStatus,
          reasonCode: opts?.reasonCode,
          note: opts?.note,
          createdAt: now,
        },
        ...(item.events || []),
      ],
    }
    await upsertOpportunity(updated)
    return updated
  }

  const addWorkLog = async (id: string, log: Omit<WorkLog, 'id' | 'createdAt'>) => {
    const item = getOpportunity(id)
    if (!item) throw new Error('案件が見つかりません')
    if (log.minutes <= 0) throw new Error('作業時間は1分以上です')
    const entry: WorkLog = {
      ...log,
      id: ulid(),
      createdAt: new Date().toISOString(),
    }
    const updated: Opportunity = {
      ...item,
      workLogs: [entry, ...(item.workLogs || [])],
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    await upsertOpportunity(updated)
    return updated
  }

  const saveFinancial = async (
    id: string,
    input: {
      contractYen: number
      feeRatePercent?: number
      withholdingYen?: number
      expenseYen?: number
      paidAt?: string | null
      completedAt?: string | null
    },
  ) => {
    const item = getOpportunity(id)
    if (!item) throw new Error('案件が見つかりません')
    const calc = calcFinancial({
      contractYen: input.contractYen,
      feeRatePercent: input.feeRatePercent ?? profile.value.feeRate ?? 20,
      withholdingYen: input.withholdingYen,
      expenseYen: input.expenseYen,
    })
    const financial: FinancialResult = {
      ...calc,
      paidAt: input.paidAt ?? item.financial?.paidAt ?? null,
      completedAt: input.completedAt ?? item.financial?.completedAt ?? null,
    }
    const updated: Opportunity = {
      ...item,
      financial,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    await upsertOpportunity(updated)
    return updated
  }

  const addReply = async (id: string, reply: { body: string; extracted?: unknown; draftReply?: string }) => {
    const item = getOpportunity(id)
    if (!item) throw new Error('案件が見つかりません')
    const entry: ReplyRecord = {
      id: ulid(),
      body: reply.body,
      createdAt: new Date().toISOString(),
      extracted: reply.extracted,
      draftReply: reply.draftReply,
    }
    const updated: Opportunity = {
      ...item,
      replies: [entry, ...(item.replies || [])],
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    await upsertOpportunity(updated)
    if (item.status === 'applied') {
      return addStatusEvent(id, 'replied', { note: '返信を記録' })
    }
    return updated
  }

  const appendDiagnosisVersion = async (
    id: string,
    version: NonNullable<Opportunity['diagnosisVersions']>[number],
  ) => {
    const item = getOpportunity(id)
    if (!item) throw new Error('案件が見つかりません')
    const nextVersion = (item.diagnosisVersions?.[0]?.version || 0) + 1
    const updated: Opportunity = {
      ...item,
      recommendation: (version.recommendation as Opportunity['recommendation']) || item.recommendation,
      diagnosisVersions: [{ ...version, version: nextVersion }, ...(item.diagnosisVersions || [])],
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    await upsertOpportunity(updated)
    return updated
  }

  return {
    profile,
    pipeline,
    stats,
    usage,
    ready,
    init,
    saveProfile,
    savePipeline,
    saveStats,
    getOpportunity,
    upsertOpportunity,
    addStatusEvent,
    addWorkLog,
    saveFinancial,
    addReply,
    appendDiagnosisVersion,
    assertAiBudget,
    trackAiSuccess,
    trackAiFailure,
  }
}
