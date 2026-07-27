<script setup lang="ts">
import { ulid } from 'ulid'
import {
  INIT_JOB_INPUT,
  normalizeJobInput,
  type JobInput,
  type RequirementEvidence,
  normalizeOpportunity,
} from '#shared/types'
import type {
  DiagnosisResult,
  EffortEstimate,
  ExtractionResult,
  ProposalResult,
  SafetyFinding,
} from '#shared/schemas/ai'
import { STORAGE_KEYS } from '#shared/constants'
import {
  hasBlockingEvidenceGaps,
  initRequirementEvidences,
  parseFlexyBudget,
  resolveJobFeeRate,
} from '#shared/domain/flexy'

const route = useRoute()
const router = useRouter()
const { profile, stats, saveStats, upsertOpportunity, assertAiBudget, trackAiSuccess, trackAiFailure } = useClearBidStore()

const step = ref(0)
const loading = ref(false)
const loadMsg = ref('')
const regenerating = ref(false)
const inp = ref<JobInput>(normalizeJobInput({ ...INIT_JOB_INPUT }))
const ext = ref<ExtractionResult | null>(null)
const safety = ref<SafetyFinding[]>([])
const effort = ref<EffortEstimate | null>(null)
const diag = ref<DiagnosisResult | null>(null)
const proposal = ref<ProposalResult | null>(null)
const copied = ref(false)
const evidences = ref<RequirementEvidence[]>([])

const isFlexy = computed(() => inp.value.platform === 'flexy')
const canGenerateProposal = computed(() => {
  if (!isFlexy.value) return true
  if (!evidences.value.length) return true
  if (hasBlockingEvidenceGaps(evidences.value)) return false
  return evidences.value.every((e) => e.status !== 'supported' || e.evidenceNote.trim())
})

function applyParsedBudget(body: string, title: string) {
  if (inp.value.platform !== 'flexy') return
  const parsed = parseFlexyBudget(`${title}\n${body}`)
  if (parsed.budgetType === 'monthly') {
    inp.value = {
      ...inp.value,
      budgetType: 'monthly',
      engagementType: 'ongoing',
      budgetMin: parsed.budgetMinYen != null ? String(parsed.budgetMinYen) : inp.value.budgetMin,
      budgetMax: parsed.budgetMaxYen != null ? String(parsed.budgetMaxYen) : inp.value.budgetMax,
    }
  }
}

function reset() {
  step.value = 0
  ext.value = null
  safety.value = []
  effort.value = null
  diag.value = null
  proposal.value = null
  copied.value = false
  evidences.value = []
  inp.value = normalizeJobInput({
    ...INIT_JOB_INPUT,
    platform: profile.value.platform || 'crowdworks',
  })
  if (import.meta.client) localStorage.removeItem(STORAGE_KEYS.DRAFT_INPUT)
}

onMounted(() => {
  if (route.query.reset === '1') {
    reset()
    router.replace('/diagnose')
    return
  }
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DRAFT_INPUT)
      if (raw) inp.value = normalizeJobInput({ ...INIT_JOB_INPUT, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }
})

watch(
  inp,
  (v) => {
    if (import.meta.client && step.value === 0) {
      localStorage.setItem(STORAGE_KEYS.DRAFT_INPUT, JSON.stringify(v))
    }
  },
  { deep: true },
)

async function doExtract() {
  if (!inp.value.title.trim() || !inp.value.body.trim()) return
  try {
    assertAiBudget('extract')
  } catch (e) {
    alert(e instanceof Error ? e.message : '利用上限です')
    return
  }
  loading.value = true
  loadMsg.value = '募集内容を整理しています...'
  try {
    const r = await $fetch<ExtractionResult>('/api/ai/extract', {
      method: 'POST',
      body: {
        title: inp.value.title,
        body: inp.value.body,
        platform: inp.value.platform,
      },
    })
    ext.value = r
    applyParsedBudget(inp.value.body, inp.value.title)
    if (isFlexy.value) {
      const reqs = r.requiredRequirements?.length
        ? r.requiredRequirements
        : r.requiredSkills || []
      evidences.value = initRequirementEvidences(reqs, profile.value)
    } else {
      evidences.value = []
    }
    step.value = 1
    await trackAiSuccess('extract')
  } catch (e) {
    console.error(e)
    await trackAiFailure('extract')
    alert('抽出に失敗しました。もう一度お試しください。')
  } finally {
    loading.value = false
  }
}

async function doSafety() {
  loading.value = true
  loadMsg.value = '安全チェック・工数見積り...'
  try {
    const r = await $fetch<{ safety: SafetyFinding[]; effort: EffortEstimate }>('/api/ai/safety-effort', {
      method: 'POST',
      body: {
        title: inp.value.title,
        body: inp.value.body,
        budgetMin: inp.value.budgetMin,
        client: {
          rating: inp.value.clientRating,
          reviews: inp.value.clientReviews,
          orders: inp.value.clientOrders,
          completionRate: inp.value.clientCompletionRate,
          verified: inp.value.clientVerified,
          certified: inp.value.clientCertified,
        },
        profile: profile.value,
      },
    })
    safety.value = r.safety || []
    effort.value = r.effort
    step.value = 2
  } catch (e) {
    console.error(e)
    alert('安全チェックに失敗しました。')
  } finally {
    loading.value = false
  }
}

async function doDiag() {
  if (!ext.value || !effort.value) return
  try {
    assertAiBudget('diagnose')
  } catch (e) {
    alert(e instanceof Error ? e.message : '利用上限です')
    return
  }
  loading.value = true
  loadMsg.value = '5軸で診断しています...'
  try {
    // Spec: only open findings affect recommendation; inferred items stay for display.
    const openSafety = safety.value.filter((s) => s.status === 'open')
    const confirmedExtraction = {
      ...ext.value,
      deliverables: (ext.value.deliverables || []).filter((d) => d.provenance === 'confirmed'),
      requiredSkills: (ext.value.requiredSkills || []).filter((d) => d.provenance === 'confirmed'),
      requiredRequirements: (ext.value.requiredRequirements || []).filter((d) => d.provenance === 'confirmed'),
      preferredRequirements: (ext.value.preferredRequirements || []).filter((d) => d.provenance === 'confirmed'),
      budget: ext.value.budget?.provenance === 'confirmed' ? ext.value.budget : { text: '不明', provenance: 'unknown' as const, quote: '' },
      deadline: ext.value.deadline?.provenance === 'confirmed' ? ext.value.deadline : { text: '不明', provenance: 'unknown' as const, quote: '' },
      role: ext.value.role?.provenance === 'confirmed' ? ext.value.role : ext.value.role,
      workDays: ext.value.workDays?.provenance === 'confirmed' ? ext.value.workDays : ext.value.workDays,
      workStyle: ext.value.workStyle?.provenance === 'confirmed' ? ext.value.workStyle : ext.value.workStyle,
      requiredAvailability: ext.value.requiredAvailability?.provenance === 'confirmed'
        ? ext.value.requiredAvailability
        : ext.value.requiredAvailability,
    }
    const feeRatePercent = resolveJobFeeRate({
      platform: inp.value.platform,
      jobFeeRatePercent: inp.value.feeRatePercent,
      profileFeeRate: profile.value.feeRate,
    })
    const r = await $fetch<DiagnosisResult>('/api/ai/diagnose', {
      method: 'POST',
      body: {
        title: inp.value.title,
        body: inp.value.body,
        extraction: confirmedExtraction,
        safety: openSafety,
        effort: effort.value,
        profile: profile.value,
        budgetMinYen: inp.value.budgetMin ? Number(inp.value.budgetMin) : null,
        budgetMaxYen: inp.value.budgetMax ? Number(inp.value.budgetMax) : null,
        feeRatePercent,
        applicants: inp.value.applicants ? Number(inp.value.applicants) : null,
        engagementType: inp.value.engagementType,
        budgetType: inp.value.budgetType,
        expectedMonthlyHoursMin: inp.value.expectedMonthlyHoursMin,
        expectedMonthlyHoursMax: inp.value.expectedMonthlyHoursMax,
        requirementEvidences: evidences.value,
      },
    })
    diag.value = r
    step.value = 3
    await saveStats({ ...stats.value, diagnosed: stats.value.diagnosed + 1 })
    await trackAiSuccess('diagnose')
  } catch (e) {
    console.error(e)
    await trackAiFailure('diagnose')
    alert('診断に失敗しました。')
  } finally {
    loading.value = false
  }
}

async function doProposal(forceStrategy?: string) {
  if (!diag.value || !ext.value) return
  if (!canGenerateProposal.value) {
    alert('必須要件の経験有無を確認すると、実績を誇張せず応募文を作れます。')
    return
  }
  try {
    assertAiBudget('proposal')
  } catch (e) {
    alert(e instanceof Error ? e.message : '利用上限です')
    return
  }
  if (forceStrategy) regenerating.value = true
  else {
    loading.value = true
    loadMsg.value = isFlexy.value ? '応募希望メッセージを作成しています...' : '提案文を作成しています...'
  }
  try {
    const r = await $fetch<ProposalResult>('/api/ai/proposal', {
      method: 'POST',
      body: {
        title: inp.value.title,
        diagnosis: diag.value,
        extraction: ext.value,
        profile: profile.value,
        forceStrategy,
        platform: inp.value.platform,
        jobUrl: inp.value.url,
        requirementEvidences: evidences.value,
        consultantQuestions: (diag.value.preQuestions || []).filter(
          (q) => !/経験|根拠|本人|必須要件/.test(q),
        ),
      },
    })
    proposal.value = r
    step.value = 4
    await trackAiSuccess('proposal')
  } catch (e) {
    console.error(e)
    await trackAiFailure('proposal')
    alert(isFlexy.value ? '応募希望メッセージの生成に失敗しました。' : '提案文の生成に失敗しました。')
  } finally {
    loading.value = false
    regenerating.value = false
  }
}

function doCopy() {
  if (proposal.value?.body) {
    navigator.clipboard.writeText(proposal.value.body).catch(() => {})
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function buildOpportunityBase(status: 'applied' | 'skipped', reason?: string) {
  const tasks = effort.value?.tasks || []
  const likely = tasks.reduce((s, t) => s + t.likely, 0)
  const max = tasks.reduce((s, t) => s + t.max, 0)
  const buf = effort.value?.bufferRate || 0
  const now = new Date().toISOString()
  const date = now.slice(0, 10)
  const version = {
    id: ulid(),
    version: 1,
    createdAt: now,
    recommendation: diag.value?.recommendation,
    recommendationReason: diag.value?.recommendationReason,
    userDecision: status === 'applied' ? 'applied' : 'skipped',
    extraction: ext.value,
    safety: safety.value,
    effort: effort.value,
    axes: diag.value?.axes,
    proposal: proposal.value,
  }
  return normalizeOpportunity({
    id: ulid(),
    title: inp.value.title || '無題',
    platform: inp.value.platform,
    status,
    date,
    updatedAt: date,
    body: inp.value.body,
    url: inp.value.url,
    budgetType: inp.value.budgetType,
    budgetMin: inp.value.budgetMin,
    budgetMax: inp.value.budgetMax,
    deadline: inp.value.deadline,
    applicants: inp.value.applicants,
    recommendation: diag.value?.recommendation,
    strategy: proposal.value?.strategy,
    skipReason: reason,
    estimatedLikelyHours: tasks.length ? Math.round(likely * (1 + buf) * 10) / 10 : undefined,
    estimatedMaxHours: tasks.length ? Math.round(max * (1 + buf) * 10) / 10 : undefined,
    client: {
      rating: inp.value.clientRating,
      reviews: inp.value.clientReviews,
      orders: inp.value.clientOrders,
      completionRate: inp.value.clientCompletionRate,
      verified: inp.value.clientVerified,
      certified: inp.value.clientCertified,
    },
    events: [
      {
        id: ulid(),
        fromStatus: null,
        toStatus: status,
        reasonCode: reason,
        createdAt: now,
      },
    ],
    workLogs: [],
    financial: null,
    diagnosisVersions: diag.value || effort.value || ext.value ? [version] : [],
    replies: [],
  })
}

async function doApply() {
  await upsertOpportunity(buildOpportunityBase('applied'))
  reset()
  router.push('/pipeline')
}

async function doSkip(reason: string) {
  await upsertOpportunity(buildOpportunityBase('skipped', reason))
  reset()
  router.push('/pipeline')
}
</script>

<template>
  <div v-if="loading" class="cb-page">
    <div class="mt-20 text-center">
      <div class="cb-spinner" />
      <p class="mt-4 text-sm font-semibold text-slate-700">{{ loadMsg }}</p>
    </div>
  </div>
  <DiagnoseStepInput
    v-else-if="step === 0"
    v-model="inp"
    @submit="doExtract"
  />
  <DiagnoseStepExtract
    v-else-if="step === 1"
    :ext="ext"
    :evidences="evidences"
    :is-flexy="isFlexy"
    @update:ext="ext = $event"
    @update:evidences="evidences = $event"
    @next="doSafety"
    @back="step = 0"
  />
  <DiagnoseStepSafety
    v-else-if="step === 2"
    :safety="safety"
    :effort="effort"
    @update:safety="safety = $event"
    @update:effort="effort = $event"
    @next="doDiag"
    @back="step = 1"
    @skip="doSkip('危険信号')"
  />
  <DiagnoseStepResult
    v-else-if="step === 3"
    :diag="diag"
    :is-flexy="isFlexy"
    :extraction="ext"
    :job="inp"
    :evidences="evidences"
    :can-generate="canGenerateProposal"
    @gen="doProposal"
    @skip="doSkip('診断結果')"
    @back="step = 2"
  />
  <DiagnoseStepProposal
    v-else
    :proposal="proposal"
    :copied="copied"
    :regenerating="regenerating"
    :is-flexy="isFlexy"
    @copy="doCopy"
    @apply="doApply"
    @regenerate="doProposal"
    @back="step = 3"
  />
</template>
