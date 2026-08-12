import { ulid } from 'ulid'
import { AI_USAGE_LIMITS } from '#shared/constants'
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
  normalizeProfile,
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
import { apiFetch } from './useAuth'

type SyncKey = 'profile' | 'pipeline' | 'stats' | 'ai_usage'

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

function normalizePipeline(raw: Partial<Opportunity>[]): Opportunity[] {
  return raw.map((r) =>
    normalizeOpportunity({
      id: r.id || ulid(),
      title: r.title || '無題',
      platform: (r.platform as Opportunity['platform']) || 'crowdworks',
      status: (r.status as StatusCode) || 'draft',
      date: r.date || new Date().toISOString().slice(0, 10),
      ...r,
    }),
  )
}

async function syncPut(key: SyncKey, value: unknown) {
  if (!import.meta.client) return
  await apiFetch('/api/sync', {
    method: 'PUT',
    body: { key, value },
  })
}

export function useClearBidStore() {
  const profile = useState<UserProfile>('cb-profile', () => ({ ...INIT_PROFILE }))
  const pipeline = useState<Opportunity[]>('cb-pipeline', () => [])
  const stats = useState<AppStats>('cb-stats', () => ({ ...INIT_STATS }))
  const usage = useState<AiUsageState>('cb-usage', () => emptyUsage())
  const ready = useState<boolean>('cb-ready', () => false)
  const remoteEnabled = useState<boolean>('cb-remote', () => false)
  const sessionUser = useState<{ id: string; email: string; displayName?: string | null } | null>('cb-user', () => null)

  const resetLocalState = () => {
    profile.value = { ...INIT_PROFILE }
    pipeline.value = []
    stats.value = { ...INIT_STATS }
    usage.value = emptyUsage()
    ready.value = false
    remoteEnabled.value = false
    sessionUser.value = null
  }

  const init = async () => {
    if (ready.value) return
    if (!import.meta.client) {
      ready.value = true
      return
    }

    const sync = await apiFetch<{
      mode: string
      user?: { id: string; email: string; displayName?: string | null }
      documents?: Partial<Record<SyncKey, unknown>> | null
    }>('/api/sync')

    if (sync.mode !== 'supabase') {
      throw new Error('Supabase が未設定です。環境変数を確認してください。')
    }

    remoteEnabled.value = true
    sessionUser.value = sync.user || null
    const docs = sync.documents || {}

    profile.value = normalizeProfile((docs.profile as UserProfile) || INIT_PROFILE)
    pipeline.value = Array.isArray(docs.pipeline)
      ? normalizePipeline(docs.pipeline as Partial<Opportunity>[])
      : []
    const loadedStats = (docs.stats as AppStats) || INIT_STATS
    stats.value = { ...recomputeStats(pipeline.value, loadedStats), diagnosed: loadedStats.diagnosed || 0 }
    usage.value = (docs.ai_usage as AiUsageState) || emptyUsage()
    ready.value = true
  }

  const persistPipeline = async (items: Opportunity[]) => {
    pipeline.value = items
    const next = recomputeStats(items, stats.value)
    stats.value = next
    await syncPut('pipeline', items)
    await syncPut('stats', next)
  }

  const saveProfile = async (p: UserProfile) => {
    const normalized = normalizeProfile(p)
    profile.value = normalized
    await syncPut('profile', normalized)
  }

  const savePipeline = async (items: PipelineItem[]) => {
    await persistPipeline(items.map((i) => normalizeOpportunity(i)))
  }

  const saveStats = async (s: AppStats) => {
    stats.value = s
    await syncPut('stats', s)
  }

  const persistUsage = async (u: AiUsageState) => {
    usage.value = u
    await syncPut('ai_usage', u)
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

  const exportBackup = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'clear-bid',
    profile: profile.value,
    pipeline: pipeline.value,
    stats: stats.value,
    ai_usage: usage.value,
    draft_input: null,
  })

  const importBackup = async (raw: unknown) => {
    const data = raw as {
      profile?: UserProfile
      pipeline?: Partial<Opportunity>[]
      stats?: AppStats
      ai_usage?: AiUsageState
    }
    if (!data || typeof data !== 'object') throw new Error('バックアップの形式が不正です')
    if (!data.profile && !Array.isArray(data.pipeline)) {
      throw new Error('プロフィールまたは案件データが見つかりません')
    }
    if (data.profile) await saveProfile(normalizeProfile(data.profile))
    if (Array.isArray(data.pipeline)) await persistPipeline(normalizePipeline(data.pipeline))
    if (data.stats) await saveStats({ ...INIT_STATS, ...data.stats })
    if (data.ai_usage) await persistUsage(data.ai_usage)
  }

  return {
    profile,
    pipeline,
    stats,
    usage,
    ready,
    remoteEnabled,
    /** @deprecated use remoteEnabled */
    d1Enabled: remoteEnabled,
    sessionUser,
    init,
    resetLocalState,
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
    exportBackup,
    importBackup,
  }
}
