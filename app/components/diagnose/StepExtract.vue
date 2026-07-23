<script setup lang="ts">
import type { ExtractionResult } from '#shared/schemas/ai'

defineProps<{
  ext: ExtractionResult | null
}>()
defineEmits<{ next: []; back: [] }>()

function badge(p: string) {
  if (p === 'confirmed') return { b: '#dcfce7', c: '#166534', l: '確定' }
  if (p === 'inferred') return { b: '#fef3c7', c: '#92400e', l: '推定' }
  return { b: '#f1f5f9', c: '#475569', l: '不明' }
}

const sections = (ext: ExtractionResult) =>
  [
    ['成果物', ext.deliverables],
    ['必須スキル', ext.requiredSkills],
    ['予算', ext.budget],
    ['納期', ext.deadline],
    ['MTG・連絡', ext.mtgConditions],
    ['保守・運用', ext.maintenance],
    ['修正条件', ext.revisionTerms],
    ['選定基準', ext.selectionCriteria],
  ] as const
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 入力に戻る</button>
    <h1 class="cb-h1">抽出結果の確認</h1>
    <p class="mb-2.5 text-xs text-slate-500">推定情報は確認するまで診断計算に使いません。</p>

    <template v-if="!ext">
      <p>抽出に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div v-for="[label, data] in sections(ext)" :key="label" class="cb-card mb-1.5">
        <p class="mb-1 text-[11px] font-semibold text-slate-500">{{ label }}</p>
        <template v-if="Array.isArray(data)">
          <div v-for="(it, i) in data" :key="i" class="mb-1">
            <div class="flex items-center gap-1">
              <span
                class="rounded-md px-1.5 py-px text-[9px] font-bold"
                :style="{ background: badge(it.provenance).b, color: badge(it.provenance).c }"
              >{{ badge(it.provenance).l }}</span>
              <span class="text-[13px] text-slate-700">{{ it.text }}</span>
            </div>
            <p
              v-if="it.quote && it.provenance === 'confirmed'"
              class="m-0 mt-px text-[11px] italic text-slate-400"
            >「{{ it.quote }}」</p>
          </div>
        </template>
        <template v-else-if="data">
          <div class="mb-1">
            <div class="flex items-center gap-1">
              <span
                class="rounded-md px-1.5 py-px text-[9px] font-bold"
                :style="{ background: badge(data.provenance).b, color: badge(data.provenance).c }"
              >{{ badge(data.provenance).l }}</span>
              <span class="text-[13px] text-slate-700">{{ data.text || '─' }}</span>
            </div>
            <p
              v-if="data.quote && data.provenance === 'confirmed'"
              class="m-0 mt-px text-[11px] italic text-slate-400"
            >「{{ data.quote }}」</p>
          </div>
        </template>
      </div>

      <div v-if="ext.unknowns?.length" class="cb-card mb-1.5 border-l-[3px] border-l-amber-500">
        <p class="mb-1 text-[11px] font-semibold text-amber-600">不明点</p>
        <p v-for="(u, i) in ext.unknowns" :key="i" class="my-0.5 text-xs text-slate-700">• {{ u }}</p>
      </div>

      <button class="cb-cta" @click="$emit('next')">安全チェック・工数見積りへ</button>
    </template>
  </div>
</template>
