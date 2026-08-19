<script setup lang="ts">
import {
  APPLICATION_TYPES,
  BUDGET_TYPES,
  DEFAULT_FEE_RATES,
  PLATFORMS,
} from '#shared/constants'
import { inferPlatformFromText } from '#shared/domain/applicationJudgment'
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

function onPlatformChange(platform: JobInput['platform']) {
  const next: JobInput = {
    ...props.modelValue,
    platform,
  }
  if (platform === 'flexy') {
    next.engagementType = 'ongoing'
    next.budgetType = 'monthly'
    if (!next.feeRatePercent && next.feeRatePercent !== '0') {
      next.feeRatePercent = String(DEFAULT_FEE_RATES.flexy ?? 0)
    }
  }
  if (platform === 'youtrust' && (!next.applicationType || next.applicationType === 'unknown')) {
    next.applicationType = 'hear_more'
  }
  emit('update:modelValue', next)
}

function maybeInferPlatform() {
  const inferred = inferPlatformFromText(
    props.modelValue.title,
    props.modelValue.body,
    props.modelValue.url || '',
  )
  if (inferred && inferred !== props.modelValue.platform) {
    onPlatformChange(inferred)
  }
}

const ok = computed(() => Boolean(inp.value.title.trim() && inp.value.body.trim()))
const isFlexy = computed(() => inp.value.platform === 'flexy')
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">案件を診断する</h1>
    <p class="cb-lead">募集文を貼り付けて、応募すべきか見極めます。</p>

    <div class="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
      <div class="lg:col-span-7">
        <label class="cb-label">案件タイトル *</label>
        <input
          class="cb-input"
          :value="inp.title"
          placeholder="例: 業務システムの改善支援"
          @input="u('title', ($event.target as HTMLInputElement).value)"
          @blur="maybeInferPlatform"
        >

        <label class="cb-label">募集詳細 *</label>
        <textarea
          class="cb-input min-h-[200px] resize-y leading-relaxed lg:min-h-[320px] lg:text-sm"
          rows="8"
          :value="inp.body"
          placeholder="募集文をそのまま貼り付け..."
          @input="u('body', ($event.target as HTMLTextAreaElement).value)"
          @blur="maybeInferPlatform"
        />

        <label class="cb-label">募集URL（任意）</label>
        <input
          class="cb-input"
          type="url"
          :value="inp.url || ''"
          placeholder="https://..."
          @input="u('url', ($event.target as HTMLInputElement).value)"
          @blur="maybeInferPlatform"
        >
      </div>

      <div class="lg:col-span-5">
        <label class="cb-label">募集媒体</label>
        <select
          class="cb-input"
          :value="inp.platform"
          @change="onPlatformChange(($event.target as HTMLSelectElement).value as JobInput['platform'])"
        >
          <option v-for="(label, key) in PLATFORMS" :key="key" :value="key">{{ label }}</option>
        </select>

        <label class="cb-label">会社名</label>
        <input
          class="cb-input"
          :value="inp.companyName || ''"
          placeholder="任意"
          @input="u('companyName', ($event.target as HTMLInputElement).value)"
        >

        <label class="cb-label">募集者名（任意）</label>
        <input
          class="cb-input"
          :value="inp.recruiterName || ''"
          placeholder="任意"
          @input="u('recruiterName', ($event.target as HTMLInputElement).value)"
        >

        <label class="cb-label">応募形式</label>
        <select
          class="cb-input"
          :value="inp.applicationType || 'unknown'"
          @change="u('applicationType', ($event.target as HTMLSelectElement).value as JobInput['applicationType'])"
        >
          <option v-for="(label, key) in APPLICATION_TYPES" :key="key" :value="key">{{ label }}</option>
        </select>

    <div v-if="isFlexy" class="cb-card mb-3 border border-blue-100 bg-blue-50/40">
      <p class="mb-2 text-[13px] font-bold text-slate-900">FLEXY案件条件</p>
      <p class="mb-2 text-[11px] leading-relaxed text-slate-500">
        月間稼働時間が不明な場合は空欄のままで構いません。週の稼働日数から勝手に時間換算しません。
      </p>
      <div class="grid grid-cols-2 gap-1.5">
        <div>
          <label class="cb-label">想定月間時間・下限</label>
          <input
            class="cb-input"
            type="number"
            :value="inp.expectedMonthlyHoursMin || ''"
            placeholder="空欄可"
            @input="u('expectedMonthlyHoursMin', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <div>
          <label class="cb-label">想定月間時間・上限</label>
          <input
            class="cb-input"
            type="number"
            :value="inp.expectedMonthlyHoursMax || ''"
            placeholder="空欄可"
            @input="u('expectedMonthlyHoursMax', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
      <label class="cb-label">手数料率（%）</label>
      <input
        class="cb-input"
        type="number"
        :value="inp.feeRatePercent ?? ''"
        placeholder="0"
        @input="u('feeRatePercent', ($event.target as HTMLInputElement).value)"
      >
      <p class="m-0 text-[11px] text-slate-400">初期値は FLEXY 0%。実際の契約条件があれば上書きしてください。</p>
    </div>

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
    </div>
  </div>
</template>
