<script setup lang="ts">
import type { ExtractionResult } from '#shared/schemas/ai'

type Item = { text: string; provenance: 'confirmed' | 'inferred' | 'unknown'; quote?: string }

const props = defineProps<{
  ext: ExtractionResult | null
}>()
const emit = defineEmits<{
  'update:ext': [ExtractionResult]
  next: []
  back: []
}>()

const local = ref<ExtractionResult | null>(null)
watch(
  () => props.ext,
  (v) => {
    local.value = v ? JSON.parse(JSON.stringify(v)) : null
  },
  { immediate: true },
)

function badge(p: string) {
  if (p === 'confirmed') return { b: '#dcfce7', c: '#166534', l: '確定' }
  if (p === 'inferred') return { b: '#fef3c7', c: '#92400e', l: '推定' }
  return { b: '#f1f5f9', c: '#475569', l: '不明' }
}

function confirmItem(item: Item) {
  item.provenance = 'confirmed'
  sync()
}

function updateText(item: Item, text: string) {
  item.text = text
  sync()
}

function sync() {
  if (local.value) emit('update:ext', JSON.parse(JSON.stringify(local.value)))
}

const arraySections = computed(() => {
  if (!local.value) return []
  return [
    ['成果物', local.value.deliverables],
    ['必須スキル', local.value.requiredSkills],
  ] as const
})

const scalarSections = computed(() => {
  if (!local.value) return []
  return [
    ['予算', 'budget'],
    ['納期', 'deadline'],
    ['MTG・連絡', 'mtgConditions'],
    ['保守・運用', 'maintenance'],
    ['修正条件', 'revisionTerms'],
    ['選定基準', 'selectionCriteria'],
  ] as const
})
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 入力に戻る</button>
    <h1 class="cb-h1">抽出結果の確認</h1>
    <p class="mb-2.5 text-xs text-slate-500">推定は「確定にする」まで診断計算に使いません。文言も修正できます。</p>

    <template v-if="!local">
      <p>抽出に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div v-for="[label, data] in arraySections" :key="label" class="cb-card mb-1.5">
        <p class="mb-1 text-[11px] font-semibold text-slate-500">{{ label }}</p>
        <div v-for="(it, i) in data" :key="i" class="mb-2">
          <div class="mb-1 flex items-center gap-1">
            <span
              class="rounded-md px-1.5 py-px text-[9px] font-bold"
              :style="{ background: badge(it.provenance).b, color: badge(it.provenance).c }"
            >{{ badge(it.provenance).l }}</span>
            <button
              v-if="it.provenance !== 'confirmed'"
              class="text-[10px] font-semibold text-blue-500"
              @click="confirmItem(it)"
            >
              確定にする
            </button>
          </div>
          <input class="cb-input mb-0" :value="it.text" @input="updateText(it, ($event.target as HTMLInputElement).value)">
          <p v-if="it.quote && it.provenance === 'confirmed'" class="m-0 mt-1 text-[11px] italic text-slate-400">「{{ it.quote }}」</p>
        </div>
      </div>

      <div v-for="[label, key] in scalarSections" :key="key" class="cb-card mb-1.5">
        <p class="mb-1 text-[11px] font-semibold text-slate-500">{{ label }}</p>
        <template v-if="local[key]">
          <div class="mb-1 flex items-center gap-1">
            <span
              class="rounded-md px-1.5 py-px text-[9px] font-bold"
              :style="{ background: badge(local[key]!.provenance).b, color: badge(local[key]!.provenance).c }"
            >{{ badge(local[key]!.provenance).l }}</span>
            <button
              v-if="local[key]!.provenance !== 'confirmed'"
              class="text-[10px] font-semibold text-blue-500"
              @click="confirmItem(local[key]!)"
            >
              確定にする
            </button>
          </div>
          <input
            class="cb-input mb-0"
            :value="local[key]!.text"
            @input="updateText(local[key]!, ($event.target as HTMLInputElement).value)"
          >
        </template>
      </div>

      <div v-if="local.unknowns?.length" class="cb-card mb-1.5 border-l-[3px] border-l-amber-500">
        <p class="mb-1 text-[11px] font-semibold text-amber-600">不明点</p>
        <p v-for="(u, i) in local.unknowns" :key="i" class="my-0.5 text-xs text-slate-700">• {{ u }}</p>
      </div>

      <button class="cb-cta" @click="$emit('next')">安全チェック・工数見積りへ</button>
    </template>
  </div>
</template>
