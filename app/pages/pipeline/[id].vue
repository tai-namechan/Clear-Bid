<script setup lang="ts">
import { STATUSES, SKIP_REASONS, WORK_LOG_CATEGORIES, PLATFORMS, REC } from '#shared/constants'
import { nextStatuses, requiresReason, totalWorkMinutes, effortVarianceRate, actualHourlyYen } from '#shared/domain/pipeline'
import type { StatusCode } from '#shared/types'

const route = useRoute()
const router = useRouter()
const {
  getOpportunity,
  addStatusEvent,
  addWorkLog,
  saveFinancial,
  profile,
  ready,
  init,
} = useClearBidStore()

await init()

const id = computed(() => String(route.params.id))
const item = computed(() => getOpportunity(id.value))

const tab = ref<'overview' | 'status' | 'work' | 'money'>('overview')
const toStatus = ref<StatusCode | ''>('')
const reasonCode = ref('')
const statusNote = ref('')
const statusError = ref('')

const workCategory = ref(WORK_LOG_CATEGORIES[0])
const workMinutes = ref(60)
const workNote = ref('')
const workDate = ref(new Date().toISOString().slice(0, 10))
const workError = ref('')

const contractYen = ref(0)
const withholdingYen = ref(0)
const expenseYen = ref(0)
const paidAt = ref('')
const moneyMsg = ref('')

watch(item, (v) => {
  if (!v) return
  contractYen.value = v.financial?.contractYen || Number(v.budgetMin) || 0
  withholdingYen.value = v.financial?.withholdingYen || 0
  expenseYen.value = v.financial?.expenseYen || 0
  paidAt.value = v.financial?.paidAt || ''
}, { immediate: true })

const availableNext = computed(() => (item.value ? nextStatuses(item.value.status) : []))
const workTotalMin = computed(() => (item.value ? totalWorkMinutes(item.value) : 0))
const variance = computed(() => (item.value ? effortVarianceRate(item.value) : null))
const hourly = computed(() => (item.value ? actualHourlyYen(item.value) : null))

async function submitStatus() {
  statusError.value = ''
  if (!item.value || !toStatus.value) return
  try {
    await addStatusEvent(item.value.id, toStatus.value, {
      reasonCode: reasonCode.value || undefined,
      note: statusNote.value || undefined,
    })
    toStatus.value = ''
    reasonCode.value = ''
    statusNote.value = ''
  } catch (e) {
    statusError.value = e instanceof Error ? e.message : '更新に失敗しました'
  }
}

async function submitWork() {
  workError.value = ''
  if (!item.value) return
  try {
    await addWorkLog(item.value.id, {
      category: workCategory.value,
      minutes: Number(workMinutes.value),
      note: workNote.value || undefined,
      workedOn: workDate.value,
    })
    workNote.value = ''
  } catch (e) {
    workError.value = e instanceof Error ? e.message : '記録に失敗しました'
  }
}

async function submitMoney() {
  moneyMsg.value = ''
  if (!item.value) return
  try {
    await saveFinancial(item.value.id, {
      contractYen: Number(contractYen.value),
      feeRatePercent: profile.value.feeRate,
      withholdingYen: Number(withholdingYen.value),
      expenseYen: Number(expenseYen.value),
      paidAt: paidAt.value || null,
    })
    moneyMsg.value = '保存しました'
  } catch (e) {
    moneyMsg.value = e instanceof Error ? e.message : '保存に失敗しました'
  }
}
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="router.push('/pipeline')">← 案件一覧</button>

    <template v-if="!ready">
      <div class="cb-spinner mt-10" />
    </template>
    <template v-else-if="!item">
      <p class="text-sm text-slate-500">案件が見つかりません。</p>
    </template>
    <template v-else>
      <div class="mb-1 flex items-center gap-2">
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          :style="{ background: (STATUSES[item.status]?.c || '#94a3b8') + '18', color: STATUSES[item.status]?.c }"
        >{{ STATUSES[item.status]?.l }}</span>
        <span
          v-if="item.recommendation && REC[item.recommendation]"
          class="text-[10px] font-semibold"
          :style="{ color: REC[item.recommendation].c }"
        >{{ REC[item.recommendation].t }}</span>
      </div>
      <h1 class="cb-h1">{{ item.title }}</h1>
      <p class="mb-3 text-xs text-slate-400">
        {{ PLATFORMS[item.platform] }} · {{ item.date }}
        <span v-if="item.strategy"> · {{ item.strategy }}</span>
      </p>

      <div class="mb-3 flex gap-1 overflow-x-auto pb-1">
        <button
          v-for="t in [
            ['overview', '概要'],
            ['status', 'ステータス'],
            ['work', '作業時間'],
            ['money', '金額'],
          ] as const"
          :key="t[0]"
          class="whitespace-nowrap rounded-2xl px-3 py-1.5 text-[11px]"
          :class="tab === t[0] ? 'bg-slate-900 font-semibold text-white' : 'border border-slate-200 bg-white text-slate-500'"
          @click="tab = t[0]"
        >
          {{ t[1] }}
        </button>
      </div>

      <div v-if="tab === 'overview'" class="space-y-2">
        <div class="cb-card">
          <p class="mb-1 text-[11px] font-semibold text-slate-500">基本</p>
          <p class="m-0 text-xs text-slate-700">予算下限: {{ item.budgetMin ? `¥${Number(item.budgetMin).toLocaleString()}` : '─' }}</p>
          <p class="m-0 text-xs text-slate-700">見積標準: {{ item.estimatedLikelyHours != null ? `${item.estimatedLikelyHours}h` : '─' }}</p>
          <p class="m-0 text-xs text-slate-700">見積最大: {{ item.estimatedMaxHours != null ? `${item.estimatedMaxHours}h` : '─' }}</p>
          <p v-if="item.skipReason" class="m-0 text-xs text-slate-700">理由: {{ item.skipReason }}</p>
        </div>
        <div v-if="item.client" class="cb-card">
          <p class="mb-1 text-[11px] font-semibold text-slate-500">発注者</p>
          <p class="m-0 text-xs text-slate-700">評価 {{ item.client.rating || '─' }} / {{ item.client.reviews || 0 }}件</p>
          <p class="m-0 text-xs text-slate-700">発注 {{ item.client.orders || '─' }} · 完了率 {{ item.client.completionRate || '─' }}</p>
        </div>
        <div v-if="item.body" class="cb-card">
          <p class="mb-1 text-[11px] font-semibold text-slate-500">募集文</p>
          <p class="m-0 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{{ item.body.slice(0, 800) }}{{ item.body.length > 800 ? '…' : '' }}</p>
        </div>
      </div>

      <div v-else-if="tab === 'status'">
        <div v-if="availableNext.length" class="cb-card mb-2">
          <p class="mb-2 text-[11px] font-semibold text-slate-500">状態を更新</p>
          <label class="cb-label">次のステータス</label>
          <select v-model="toStatus" class="cb-input">
            <option value="">選択...</option>
            <option v-for="s in availableNext" :key="s" :value="s">{{ STATUSES[s]?.l || s }}</option>
          </select>
          <template v-if="toStatus && requiresReason(toStatus)">
            <label class="cb-label">理由（必須）</label>
            <select v-model="reasonCode" class="cb-input">
              <option value="">選択...</option>
              <option v-for="r in SKIP_REASONS" :key="r" :value="r">{{ r }}</option>
            </select>
          </template>
          <label class="cb-label">メモ</label>
          <input v-model="statusNote" class="cb-input" placeholder="任意">
          <p v-if="statusError" class="mb-2 text-xs text-red-600">{{ statusError }}</p>
          <button class="cb-cta" @click="submitStatus">状態を記録する</button>
        </div>
        <div v-else class="cb-card mb-2 text-xs text-slate-500">これ以上の遷移はありません（終端ステータス）。</div>
        <div v-for="ev in item.events" :key="ev.id" class="cb-card mb-1.5">
          <p class="m-0 text-xs font-semibold text-slate-800">
            {{ ev.fromStatus ? (STATUSES[ev.fromStatus]?.l || ev.fromStatus) : '─' }}
            → {{ STATUSES[ev.toStatus]?.l || ev.toStatus }}
          </p>
          <p class="m-0 text-[11px] text-slate-400">{{ ev.createdAt.slice(0, 16).replace('T', ' ') }}</p>
          <p v-if="ev.reasonCode" class="m-0 text-xs text-slate-600">理由: {{ ev.reasonCode }}</p>
          <p v-if="ev.note" class="m-0 text-xs text-slate-600">{{ ev.note }}</p>
        </div>
        <p v-if="!item.events?.length" class="text-xs text-slate-400">履歴はまだありません</p>
      </div>

      <div v-else-if="tab === 'work'">
        <div class="cb-card mb-2">
          <p class="mb-1 text-[11px] font-semibold text-slate-500">合計 {{ workTotalMin }} 分（{{ (workTotalMin / 60).toFixed(1) }}h）</p>
          <p v-if="variance != null" class="m-0 text-xs text-slate-600">
            見積り誤差率: {{ Math.round(variance * 100) }}%
          </p>
          <p v-if="hourly != null" class="m-0 text-xs text-slate-600">実績時給（税引前）: ¥{{ hourly.toLocaleString() }}</p>
        </div>
        <div class="cb-card mb-2">
          <label class="cb-label">カテゴリ</label>
          <select v-model="workCategory" class="cb-input">
            <option v-for="c in WORK_LOG_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
          <label class="cb-label">分数</label>
          <input v-model.number="workMinutes" class="cb-input" type="number" min="1">
          <label class="cb-label">作業日</label>
          <input v-model="workDate" class="cb-input" type="date">
          <label class="cb-label">メモ</label>
          <input v-model="workNote" class="cb-input">
          <p v-if="workError" class="mb-2 text-xs text-red-600">{{ workError }}</p>
          <button class="cb-cta" @click="submitWork">作業時間を追加</button>
        </div>
        <div v-for="w in item.workLogs" :key="w.id" class="cb-card mb-1.5">
          <p class="m-0 text-xs font-semibold text-slate-800">{{ w.category }} · {{ w.minutes }}分</p>
          <p class="m-0 text-[11px] text-slate-400">{{ w.workedOn }}</p>
          <p v-if="w.note" class="m-0 text-xs text-slate-600">{{ w.note }}</p>
        </div>
      </div>

      <div v-else>
        <div class="cb-card mb-2">
          <label class="cb-label">契約額（円）</label>
          <input v-model.number="contractYen" class="cb-input" type="number" min="0">
          <label class="cb-label">源泉徴収（円）</label>
          <input v-model.number="withholdingYen" class="cb-input" type="number" min="0">
          <label class="cb-label">案件経費（円）</label>
          <input v-model.number="expenseYen" class="cb-input" type="number" min="0">
          <label class="cb-label">入金日</label>
          <input v-model="paidAt" class="cb-input" type="date">
          <p class="mb-2 text-xs text-slate-500">手数料率はプロフィール設定（現在 {{ profile.feeRate }}%）を使用します。</p>
          <p v-if="item.financial" class="mb-2 text-xs text-slate-700">
            手数料 ¥{{ item.financial.feeYen.toLocaleString() }} /
            税引前手取り ¥{{ item.financial.preTaxTakeHomeYen.toLocaleString() }}
          </p>
          <p v-if="moneyMsg" class="mb-2 text-xs text-green-700">{{ moneyMsg }}</p>
          <button class="cb-cta" @click="submitMoney">金額を保存</button>
        </div>
      </div>
    </template>
  </div>
</template>
