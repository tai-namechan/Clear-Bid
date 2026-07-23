<script setup lang="ts">
import { Icons } from '~/utils/icons'
import { BLOCK_RESOLVE_REASONS } from '#shared/constants'
import type { EffortEstimate, SafetyFinding } from '#shared/schemas/ai'

const props = defineProps<{
  safety: SafetyFinding[]
  effort: EffortEstimate | null
}>()
const emit = defineEmits<{
  'update:safety': [SafetyFinding[]]
  'update:effort': [EffortEstimate]
  next: []
  back: []
  skip: []
}>()

const localSafety = ref<SafetyFinding[]>([])
const localEffort = ref<EffortEstimate | null>(null)
const resolveTarget = ref<number | null>(null)
const resolveReason = ref('')

watch(
  () => props.safety,
  (v) => {
    localSafety.value = JSON.parse(JSON.stringify(v || []))
  },
  { immediate: true },
)
watch(
  () => props.effort,
  (v) => {
    localEffort.value = v ? JSON.parse(JSON.stringify(v)) : null
  },
  { immediate: true },
)

const openBlocks = computed(() => localSafety.value.filter((s) => s.classification === 'BLOCK' && s.status === 'open'))
const ordered = computed(() => {
  const open = localSafety.value.filter((s) => s.status === 'open')
  const resolved = localSafety.value.filter((s) => s.status === 'resolved')
  const rank = { BLOCK: 0, CHECK: 1, INFO: 2 } as const
  return [...open.sort((a, b) => rank[a.classification] - rank[b.classification]), ...resolved]
})

const tMin = computed(() => localEffort.value?.tasks?.reduce((s, t) => s + Number(t.min), 0) || 0)
const tLik = computed(() => localEffort.value?.tasks?.reduce((s, t) => s + Number(t.likely), 0) || 0)
const tMax = computed(() => localEffort.value?.tasks?.reduce((s, t) => s + Number(t.max), 0) || 0)

function cls(c: string) {
  if (c === 'BLOCK') return { c: '#dc2626', l: 'BLOCK' }
  if (c === 'CHECK') return { c: '#d97706', l: 'CHECK' }
  return { c: '#0284c7', l: 'INFO' }
}

function syncSafety() {
  emit('update:safety', JSON.parse(JSON.stringify(localSafety.value)))
}
function syncEffort() {
  if (localEffort.value) emit('update:effort', JSON.parse(JSON.stringify(localEffort.value)))
}

function startResolve(idx: number) {
  resolveTarget.value = idx
  resolveReason.value = ''
}

function applyResolve() {
  if (resolveTarget.value == null || !resolveReason.value) return
  const finding = ordered.value[resolveTarget.value]
  const i = localSafety.value.findIndex(
    (s) => s.ruleId === finding.ruleId && s.quote === finding.quote && s.status === 'open',
  )
  if (i < 0) return
  localSafety.value[i] = {
    ...localSafety.value[i],
    status: 'resolved',
    resolveReason: resolveReason.value,
    resolvedAt: new Date().toISOString(),
    userNote: resolveReason.value,
  }
  resolveTarget.value = null
  resolveReason.value = ''
  syncSafety()
}

function updateTask(i: number, field: 'min' | 'likely' | 'max', value: string) {
  if (!localEffort.value) return
  const n = Math.max(0, Number(value) || 0)
  localEffort.value.tasks[i] = { ...localEffort.value.tasks[i], [field]: n }
  syncEffort()
}

function updateBuffer(value: string) {
  if (!localEffort.value) return
  localEffort.value.bufferRate = Math.min(1, Math.max(0, Number(value) / 100))
  syncEffort()
}
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 抽出結果に戻る</button>
    <h1 class="cb-h1">安全チェック・工数</h1>

    <div
      v-if="localSafety.length === 0"
      class="cb-card mb-2.5 border border-green-200 bg-green-50"
    >
      <div class="flex items-center gap-1.5">
        <CbIcon :d="Icons.check" :size="16" color="#16a34a" />
        <p class="m-0 text-[13px] font-semibold text-green-600">明確な危険信号はありません</p>
      </div>
    </div>

    <div
      v-for="(s, i) in ordered"
      :key="`${s.ruleId}-${i}`"
      class="cb-card mb-1.5"
      :style="{ borderLeft: `3px solid ${cls(s.classification).c}`, opacity: s.status === 'resolved' ? 0.65 : 1 }"
    >
      <div class="mb-1 flex items-center gap-1.5">
        <span
          class="rounded px-1.5 py-px text-[9px] font-bold text-white"
          :style="{ background: cls(s.classification).c }"
        >{{ cls(s.classification).l }}</span>
        <span class="font-mono text-[10px] text-slate-400">{{ s.ruleId }}</span>
        <span v-if="s.status === 'resolved'" class="text-[10px] font-semibold text-slate-500">解除済み</span>
      </div>
      <p class="mb-0.5 text-[13px] font-semibold text-slate-700">{{ s.reason }}</p>
      <p v-if="s.quote" class="m-0 text-[11px] italic text-slate-400">「{{ s.quote }}」</p>
      <p v-if="s.resolveReason" class="m-0 mt-1 text-[11px] text-slate-500">解除理由: {{ s.resolveReason }}</p>
      <button
        v-if="s.classification === 'BLOCK' && s.status === 'open'"
        class="mt-2 text-[11px] font-semibold text-blue-500"
        @click="startResolve(i)"
      >
        この検知を解除する
      </button>
    </div>

    <div v-if="resolveTarget != null" class="cb-card mb-2 border border-blue-200 bg-blue-50">
      <p class="mb-2 text-[12px] font-semibold text-slate-800">BLOCK 解除理由（必須）</p>
      <select v-model="resolveReason" class="cb-input">
        <option value="">選択...</option>
        <option v-for="r in BLOCK_RESOLVE_REASONS" :key="r" :value="r">{{ r }}</option>
      </select>
      <div class="flex gap-2">
        <button class="cb-cta mt-0 flex-1" :disabled="!resolveReason" @click="applyResolve">解除を記録</button>
        <button class="cb-outline-btn mt-0 flex-1" @click="resolveTarget = null">キャンセル</button>
      </div>
    </div>

    <div v-if="localEffort" class="cb-card mt-2.5">
      <div class="mb-2.5 flex items-center gap-1.5">
        <CbIcon :d="Icons.clock" :size="16" color="#334155" />
        <p class="m-0 text-[13px] font-bold text-slate-900">工数見積り（編集可）</p>
      </div>
      <div class="grid items-center gap-x-2 gap-y-1" style="grid-template-columns: 1fr 56px 56px 56px">
        <span class="text-[10px] font-semibold text-slate-400">作業</span>
        <span class="text-right text-[10px] text-slate-400">最短</span>
        <span class="text-right text-[10px] text-slate-400">標準</span>
        <span class="text-right text-[10px] text-slate-400">最大</span>
        <template v-for="(t, i) in localEffort.tasks" :key="i">
          <span class="text-xs text-slate-700">{{ t.category }}</span>
          <input class="cb-input mb-0 px-1 py-1 text-right text-xs" type="number" min="0" step="0.5" :value="t.min" @change="updateTask(i, 'min', ($event.target as HTMLInputElement).value)">
          <input class="cb-input mb-0 px-1 py-1 text-right text-xs font-semibold" type="number" min="0" step="0.5" :value="t.likely" @change="updateTask(i, 'likely', ($event.target as HTMLInputElement).value)">
          <input class="cb-input mb-0 px-1 py-1 text-right text-xs" type="number" min="0" step="0.5" :value="t.max" @change="updateTask(i, 'max', ($event.target as HTMLInputElement).value)">
        </template>
        <span class="border-t border-slate-200 pt-1 text-xs font-bold text-slate-900">合計</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-semibold text-slate-400">{{ tMin }}h</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-bold text-slate-900">{{ tLik }}h</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-semibold text-slate-400">{{ tMax }}h</span>
      </div>
      <label class="cb-label mt-2">バッファ %</label>
      <input
        class="cb-input"
        type="number"
        min="0"
        max="100"
        :value="Math.round((localEffort.bufferRate || 0.2) * 100)"
        @change="updateBuffer(($event.target as HTMLInputElement).value)"
      >
      <p class="m-0 text-[11px] text-slate-400">{{ localEffort.bufferReason }}</p>
    </div>

    <template v-if="openBlocks.length">
      <button class="cb-cta mt-3 bg-slate-500" @click="$emit('skip')">この案件を見送る</button>
      <button class="cb-outline-btn" @click="$emit('next')">リスクを理解して続ける</button>
    </template>
    <button v-else class="cb-cta" @click="$emit('next')">この工数で診断する</button>
  </div>
</template>
