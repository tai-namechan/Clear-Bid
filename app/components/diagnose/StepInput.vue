<script setup lang="ts">
import { BUDGET_TYPES, PLATFORMS } from '#shared/constants'
import type { JobInput } from '#shared/types'

const props = defineProps<{
  modelValue: JobInput
}>()
const emit = defineEmits<{
  'update:modelValue': [JobInput]
  submit: []
}>()

const showCl = ref(false)
const inp = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function u<K extends keyof JobInput>(k: K, v: JobInput[K]) {
  emit('update:modelValue', { ...props.modelValue, [k]: v })
}

const ok = computed(() => Boolean(inp.value.title.trim() && inp.value.body.trim()))
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">案件を診断する</h1>
    <p class="mb-4 text-[13px] leading-relaxed text-slate-500">
      募集文を貼り付けて、応募すべきか見極めます。
    </p>

    <label class="cb-label">利用サービス</label>
    <select class="cb-input" :value="inp.platform" @change="u('platform', ($event.target as HTMLSelectElement).value as JobInput['platform'])">
      <option v-for="(label, key) in PLATFORMS" :key="key" :value="key">{{ label }}</option>
    </select>

    <label class="cb-label">案件タイトル *</label>
    <input
      class="cb-input"
      :value="inp.title"
      placeholder="例: Instagram集計の自動化"
      @input="u('title', ($event.target as HTMLInputElement).value)"
    >

    <label class="cb-label">募集文 *</label>
    <textarea
      class="cb-input min-h-[160px] resize-y leading-relaxed"
      rows="8"
      :value="inp.body"
      placeholder="募集文をそのまま貼り付け..."
      @input="u('body', ($event.target as HTMLTextAreaElement).value)"
    />

    <label class="cb-label">予算</label>
    <div class="mb-2 flex gap-1.5">
      <select
        class="cb-input mb-0 w-[100px] shrink-0"
        :value="inp.budgetType"
        @change="u('budgetType', ($event.target as HTMLSelectElement).value as JobInput['budgetType'])"
      >
        <option v-for="(label, key) in BUDGET_TYPES" :key="key" :value="key">{{ label }}</option>
      </select>
      <input
        class="cb-input mb-0 flex-1"
        type="number"
        :value="inp.budgetMin"
        placeholder="¥ 下限"
        @input="u('budgetMin', ($event.target as HTMLInputElement).value)"
      >
      <input
        class="cb-input mb-0 flex-1"
        type="number"
        :value="inp.budgetMax"
        placeholder="¥ 上限"
        @input="u('budgetMax', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <button class="cb-link mb-3 text-xs" @click="showCl = !showCl">
      {{ showCl ? '▾ 発注者情報を閉じる' : '▸ 発注者情報を追加（精度向上）' }}
    </button>

    <div v-if="showCl" class="cb-card mb-3 bg-slate-50">
      <div class="grid grid-cols-2 gap-1.5">
        <div>
          <label class="cb-label">評価</label>
          <input class="cb-input" :value="inp.clientRating" placeholder="4.8" @input="u('clientRating', ($event.target as HTMLInputElement).value)">
        </div>
        <div>
          <label class="cb-label">評価件数</label>
          <input class="cb-input" type="number" :value="inp.clientReviews" placeholder="12" @input="u('clientReviews', ($event.target as HTMLInputElement).value)">
        </div>
        <div>
          <label class="cb-label">発注実績</label>
          <input class="cb-input" type="number" :value="inp.clientOrders" placeholder="15" @input="u('clientOrders', ($event.target as HTMLInputElement).value)">
        </div>
        <div>
          <label class="cb-label">完了率</label>
          <input class="cb-input" :value="inp.clientCompletionRate" placeholder="85%" @input="u('clientCompletionRate', ($event.target as HTMLInputElement).value)">
        </div>
      </div>
      <div class="mt-1.5 flex gap-4">
        <label class="flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" :checked="inp.clientVerified" @change="u('clientVerified', ($event.target as HTMLInputElement).checked)">
          本人確認済
        </label>
        <label class="flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" :checked="inp.clientCertified" @change="u('clientCertified', ($event.target as HTMLInputElement).checked)">
          認定クライアント
        </label>
      </div>
    </div>

    <button class="cb-cta" :disabled="!ok" @click="emit('submit')">募集内容を整理する</button>
  </div>
</template>
