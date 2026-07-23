import { STORAGE_KEYS } from '#shared/constants'
import { INIT_PROFILE, INIT_STATS, type AppStats, type PipelineItem, type UserProfile } from '#shared/types'

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

export function useClearBidStore() {
  const profile = useState<UserProfile>('cb-profile', () => ({ ...INIT_PROFILE }))
  const pipeline = useState<PipelineItem[]>('cb-pipeline', () => [])
  const stats = useState<AppStats>('cb-stats', () => ({ ...INIT_STATS }))
  const ready = useState<boolean>('cb-ready', () => false)

  const init = async () => {
    if (ready.value) return
    profile.value = await load(STORAGE_KEYS.PROFILE, { ...INIT_PROFILE })
    pipeline.value = await load(STORAGE_KEYS.PIPELINE, [])
    stats.value = await load(STORAGE_KEYS.STATS, { ...INIT_STATS })
    ready.value = true
  }

  const saveProfile = async (p: UserProfile) => {
    profile.value = p
    await save(STORAGE_KEYS.PROFILE, p)
  }

  const savePipeline = async (items: PipelineItem[]) => {
    pipeline.value = items
    await save(STORAGE_KEYS.PIPELINE, items)
  }

  const saveStats = async (s: AppStats) => {
    stats.value = s
    await save(STORAGE_KEYS.STATS, s)
  }

  return {
    profile,
    pipeline,
    stats,
    ready,
    init,
    saveProfile,
    savePipeline,
    saveStats,
  }
}
