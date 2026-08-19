<script setup lang="ts">
import { REQUIREMENT_EVIDENCE_LABELS } from '#shared/constants'
import type { ExtractionResult } from '#shared/schemas/ai'
import type { RequirementEvidence, RequirementEvidenceStatus } from '#shared/types'

type Item = { text: string; provenance: 'confirmed' | 'inferred' | 'unknown'; quote?: string }

const props = defineProps<{
  ext: ExtractionResult | null
  evidences?: RequirementEvidence[]
  isFlexy?: boolean
}>()
const emit = defineEmits<{
  'update:ext': [ExtractionResult]
  'update:evidences': [RequirementEvidence[]]
  next: []
  back: []
}>()

const local = ref<ExtractionResult | null>(null)
const localEvidences = ref<RequirementEvidence[]>([])

watch(
  () => props.ext,
  (v) => {
    local.value = v ? JSON.parse(JSON.stringify(v)) : null
  },
  { immediate: true },
)

watch(
  () => props.evidences,
  (v) => {
    localEvidences.value = v ? JSON.parse(JSON.stringify(v)) : []
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

function syncEvidences() {
  emit('update:evidences', JSON.parse(JSON.stringify(localEvidences.value)))
}

function updateEvidence(i: number, patch: Partial<RequirementEvidence>) {
  const cur = localEvidences.value[i]
  if (!cur) return
  const next = [...localEvidences.value]
  next[i] = {
    requirement: patch.requirement ?? cur.requirement,
    status: patch.status ?? cur.status,
    evidenceNote: patch.evidenceNote ?? cur.evidenceNote,
    sourceQuote: patch.sourceQuote ?? cur.sourceQuote,
  }
  localEvidences.value = next
  syncEvidences()
}

const evidenceOk = computed(() => {
  if (!props.isFlexy || localEvidences.value.length === 0) return true
  return localEvidences.value.every((e) => {
    if (e.status === 'unverified' || e.status === 'partial') return false
    if (e.status === 'supported' && !e.evidenceNote.trim()) return false
    return true
  })
})

const arraySections = computed(() => {
  if (!local.value) return []
  const sections: Array<[string, Item[]]> = [
    ['成果物', local.value.deliverables],
    ['必須スキル', local.value.requiredSkills],
  ]
  if (props.isFlexy) {
    if (local.value.requiredRequirements?.length) {
      sections.push(['必須要件', local.value.requiredRequirements])
    }
    if (local.value.preferredRequirements?.length) {
      sections.push(['歓迎要件', local.value.preferredRequirements])
    }
  }
  return sections
})

const scalarSections = computed(() => {
  if (!local.value) return []
  const base: Array<[string, keyof ExtractionResult]> = [
    ['予算', 'budget'],
    ['納期', 'deadline'],
    ['MTG・連絡', 'mtgConditions'],
    ['保守・運用', 'maintenance'],
    ['修正条件', 'revisionTerms'],
    ['選定基準', 'selectionCriteria'],
  ]
  if (props.isFlexy) {
    return [
      ['会社名', 'companyName'],
      ['職種・役割', 'role'],
      ['リモート／勤務形態', 'workStyle'],
      ['勤務地', 'workLocation'],
      ['稼働日数', 'workDays'],
      ['対応時間帯', 'requiredAvailability'],
      ['募集背景', 'recruitmentBackground'],
      ...base,
    ] as Array<[string, keyof ExtractionResult]>
  }
  return base
})

const statuses = Object.keys(REQUIREMENT_EVIDENCE_LABELS) as RequirementEvidenceStatus[]
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 入力に戻る</button>
    <h1 class="cb-h1">抽出結果の確認</h1>
    <p class="cb-lead">推定は「確定にする」まで診断計算に使いません。文言も修正できます。</p>

    <template v-if="!local">
      <p>抽出に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
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
        <template v-if="local[key] && typeof local[key] === 'object' && 'text' in (local[key] as object)">
          <div class="mb-1 flex items-center gap-1">
            <span
              class="rounded-md px-1.5 py-px text-[9px] font-bold"
              :style="{ background: badge((local[key] as Item).provenance).b, color: badge((local[key] as Item).provenance).c }"
            >{{ badge((local[key] as Item).provenance).l }}</span>
            <button
              v-if="(local[key] as Item).provenance !== 'confirmed'"
              class="text-[10px] font-semibold text-blue-500"
              @click="confirmItem(local[key] as Item)"
            >
              確定にする
            </button>
          </div>
          <input
            class="cb-input mb-0"
            :value="(local[key] as Item).text"
            @input="updateText(local[key] as Item, ($event.target as HTMLInputElement).value)"
          >
        </template>
      </div>

      <div v-if="isFlexy && localEvidences.length" class="cb-card mb-2 border border-amber-200">
        <p class="mb-1 text-[11px] font-semibold text-amber-700">必須要件の経験確認</p>
        <p class="mb-2 text-[11px] leading-relaxed text-slate-500">
          必須要件の経験有無を確認すると、実績を誇張せず応募文を作れます。「根拠あり」を選ぶ場合は根拠メモが必須です。
        </p>
        <div v-for="(ev, i) in localEvidences" :key="i" class="mb-3 border-t border-slate-100 pt-2">
          <p class="m-0 text-xs font-semibold text-slate-800">{{ ev.requirement }}</p>
          <p v-if="ev.sourceQuote" class="m-0 mt-1 text-[11px] italic text-slate-400">「{{ ev.sourceQuote }}」</p>
          <label class="cb-label">対応状態</label>
          <select
            class="cb-input"
            :value="ev.status"
            @change="updateEvidence(i, { status: ($event.target as HTMLSelectElement).value as RequirementEvidenceStatus })"
          >
            <option v-for="s in statuses" :key="s" :value="s">{{ REQUIREMENT_EVIDENCE_LABELS[s] }}</option>
          </select>
          <label class="cb-label">根拠メモ</label>
          <input
            class="cb-input mb-0"
            :value="ev.evidenceNote"
            placeholder="supported の場合は必須"
            @input="updateEvidence(i, { evidenceNote: ($event.target as HTMLInputElement).value })"
          >
        </div>
        <p v-if="!evidenceOk" class="m-0 text-[11px] text-amber-600">
          必須要件の経験有無を確認すると、実績を誇張せず応募文を作れます。
        </p>
      </div>

      <div v-if="local.unknowns?.length" class="cb-card mb-1.5 border-l-[3px] border-l-amber-500">
        <p class="mb-1 text-[11px] font-semibold text-amber-600">不明点</p>
        <p v-for="(u, i) in local.unknowns" :key="i" class="my-0.5 text-xs text-slate-700">• {{ u }}</p>
      </div>

      </div>
      <div class="cb-actions">
        <button class="cb-cta" @click="$emit('next')">安全チェック・工数見積りへ</button>
      </div>
    </template>
  </div>
</template>
