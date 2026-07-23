<script setup lang="ts">
import { Icons } from '~/utils/icons'
import type { EffortEstimate, SafetyFinding } from '#shared/schemas/ai'

const props = defineProps<{
  safety: SafetyFinding[]
  effort: EffortEstimate | null
}>()
defineEmits<{ next: []; back: []; skip: [] }>()

const blocks = computed(() => props.safety.filter((s) => s.classification === 'BLOCK'))
const checks = computed(() => props.safety.filter((s) => s.classification === 'CHECK'))
const infos = computed(() => props.safety.filter((s) => s.classification === 'INFO'))
const ordered = computed(() => [...blocks.value, ...checks.value, ...infos.value])

const tMin = computed(() => props.effort?.tasks?.reduce((s, t) => s + t.min, 0) || 0)
const tLik = computed(() => props.effort?.tasks?.reduce((s, t) => s + t.likely, 0) || 0)
const tMax = computed(() => props.effort?.tasks?.reduce((s, t) => s + t.max, 0) || 0)

function cls(c: string) {
  if (c === 'BLOCK') return { bg: '#fef2f2', c: '#dc2626', l: 'BLOCK' }
  if (c === 'CHECK') return { bg: '#fffbeb', c: '#d97706', l: 'CHECK' }
  return { bg: '#eff6ff', c: '#0284c7', l: 'INFO' }
}
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 抽出結果に戻る</button>
    <h1 class="cb-h1">安全チェック・工数</h1>

    <div
      v-if="safety.length === 0"
      class="cb-card mb-2.5 border border-green-200 bg-green-50"
    >
      <div class="flex items-center gap-1.5">
        <CbIcon :d="Icons.check" :size="16" color="#16a34a" />
        <p class="m-0 text-[13px] font-semibold text-green-600">明確な危険信号はありません</p>
      </div>
    </div>

    <div
      v-for="(s, i) in ordered"
      :key="i"
      class="cb-card mb-1.5"
      :style="{ borderLeft: `3px solid ${cls(s.classification).c}` }"
    >
      <div class="mb-1 flex items-center gap-1.5">
        <span
          class="rounded px-1.5 py-px text-[9px] font-bold text-white"
          :style="{ background: cls(s.classification).c }"
        >{{ cls(s.classification).l }}</span>
        <span class="font-mono text-[10px] text-slate-400">{{ s.ruleId }}</span>
      </div>
      <p class="mb-0.5 text-[13px] font-semibold text-slate-700">{{ s.reason }}</p>
      <p v-if="s.quote" class="m-0 text-[11px] italic text-slate-400">「{{ s.quote }}」</p>
    </div>

    <div v-if="effort" class="cb-card mt-2.5">
      <div class="mb-2.5 flex items-center gap-1.5">
        <CbIcon :d="Icons.clock" :size="16" color="#334155" />
        <p class="m-0 text-[13px] font-bold text-slate-900">工数見積り（3点）</p>
      </div>
      <div class="grid items-center gap-x-2 gap-y-1" style="grid-template-columns: 1fr auto auto auto">
        <span class="text-[10px] font-semibold text-slate-400">作業</span>
        <span class="text-right text-[10px] text-slate-400">最短</span>
        <span class="text-right text-[10px] text-slate-400">標準</span>
        <span class="text-right text-[10px] text-slate-400">最大</span>
        <template v-for="(t, i) in effort.tasks" :key="i">
          <span class="text-xs text-slate-700">{{ t.category }}</span>
          <span class="text-right text-xs text-slate-400">{{ t.min }}h</span>
          <span class="text-right text-xs font-semibold text-slate-900">{{ t.likely }}h</span>
          <span class="text-right text-xs text-slate-400">{{ t.max }}h</span>
        </template>
        <span class="border-t border-slate-200 pt-1 text-xs font-bold text-slate-900">合計</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-semibold text-slate-400">{{ tMin }}h</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-bold text-slate-900">{{ tLik }}h</span>
        <span class="border-t border-slate-200 pt-1 text-right text-xs font-semibold text-slate-400">{{ tMax }}h</span>
      </div>
      <p class="mt-1.5 text-[11px] text-slate-400">
        バッファ {{ Math.round((effort.bufferRate || 0.2) * 100) }}%（{{ effort.bufferReason }}）
      </p>
    </div>

    <template v-if="blocks.length">
      <button class="cb-cta mt-3 bg-slate-500" @click="$emit('skip')">この案件を見送る</button>
      <button class="cb-outline-btn" @click="$emit('next')">リスクを理解して続ける</button>
    </template>
    <button v-else class="cb-cta" @click="$emit('next')">この工数で診断する</button>
  </div>
</template>
