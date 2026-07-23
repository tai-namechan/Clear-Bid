<script setup lang="ts">
import { ulid } from 'ulid'
import { INIT_JOB_INPUT, type JobInput, type PipelineItem } from '#shared/types'
import type {
  DiagnosisResult,
  EffortEstimate,
  ExtractionResult,
  ProposalResult,
  SafetyFinding,
} from '#shared/schemas/ai'
import { STORAGE_KEYS } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const { profile, pipeline, stats, savePipeline, saveStats } = useClearBidStore()

const step = ref(0)
const loading = ref(false)
const loadMsg = ref('')
const inp = ref<JobInput>({ ...INIT_JOB_INPUT })
const ext = ref<ExtractionResult | null>(null)
const safety = ref<SafetyFinding[]>([])
const effort = ref<EffortEstimate | null>(null)
const diag = ref<DiagnosisResult | null>(null)
const proposal = ref<ProposalResult | null>(null)
const copied = ref(false)

function reset() {
  step.value = 0
  ext.value = null
  safety.value = []
  effort.value = null
  diag.value = null
  proposal.value = null
  copied.value = false
  inp.value = { ...INIT_JOB_INPUT, platform: profile.value.platform || 'crowdworks' }
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
      if (raw) inp.value = { ...INIT_JOB_INPUT, ...JSON.parse(raw) }
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
  loading.value = true
  loadMsg.value = '募集内容を整理しています...'
  try {
    const r = await $fetch<ExtractionResult>('/api/ai/extract', {
      method: 'POST',
      body: { title: inp.value.title, body: inp.value.body },
    })
    ext.value = r
    step.value = 1
  } catch (e) {
    console.error(e)
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
  loading.value = true
  loadMsg.value = '5軸で診断しています...'
  try {
    const r = await $fetch<DiagnosisResult>('/api/ai/diagnose', {
      method: 'POST',
      body: {
        title: inp.value.title,
        body: inp.value.body,
        extraction: ext.value,
        safety: safety.value,
        effort: effort.value,
        profile: profile.value,
        budgetMinYen: inp.value.budgetMin ? Number(inp.value.budgetMin) : null,
        feeRatePercent: profile.value.feeRate || 20,
        applicants: inp.value.applicants ? Number(inp.value.applicants) : null,
      },
    })
    diag.value = r
    step.value = 3
    await saveStats({ ...stats.value, diagnosed: stats.value.diagnosed + 1 })
  } catch (e) {
    console.error(e)
    alert('診断に失敗しました。')
  } finally {
    loading.value = false
  }
}

async function doProposal() {
  if (!diag.value || !ext.value) return
  loading.value = true
  loadMsg.value = '提案文を作成しています...'
  try {
    const r = await $fetch<ProposalResult>('/api/ai/proposal', {
      method: 'POST',
      body: {
        title: inp.value.title,
        diagnosis: diag.value,
        extraction: ext.value,
        profile: profile.value,
      },
    })
    proposal.value = r
    step.value = 4
  } catch (e) {
    console.error(e)
    alert('提案文の生成に失敗しました。')
  } finally {
    loading.value = false
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

async function doApply() {
  const it: PipelineItem = {
    id: ulid(),
    title: inp.value.title,
    platform: inp.value.platform,
    status: 'applied',
    date: new Date().toISOString().slice(0, 10),
    recommendation: diag.value?.recommendation,
    strategy: proposal.value?.strategy,
    budgetMin: inp.value.budgetMin,
  }
  await savePipeline([it, ...pipeline.value])
  await saveStats({ ...stats.value, applied: stats.value.applied + 1 })
  reset()
  router.push('/pipeline')
}

async function doSkip(reason: string) {
  const it: PipelineItem = {
    id: ulid(),
    title: inp.value.title || '無題',
    platform: inp.value.platform,
    status: 'skipped',
    date: new Date().toISOString().slice(0, 10),
    skipReason: reason,
  }
  await savePipeline([it, ...pipeline.value])
  await saveStats({ ...stats.value, skipped: stats.value.skipped + 1 })
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
    @next="doSafety"
    @back="step = 0"
  />
  <DiagnoseStepSafety
    v-else-if="step === 2"
    :safety="safety"
    :effort="effort"
    @next="doDiag"
    @back="step = 1"
    @skip="doSkip('危険信号')"
  />
  <DiagnoseStepResult
    v-else-if="step === 3"
    :diag="diag"
    @gen="doProposal"
    @skip="doSkip('診断結果')"
    @back="step = 2"
  />
  <DiagnoseStepProposal
    v-else
    :proposal="proposal"
    :copied="copied"
    @copy="doCopy"
    @apply="doApply"
    @back="step = 3"
  />
</template>
