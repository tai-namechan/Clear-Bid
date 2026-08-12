<script setup lang="ts">
import { Icons } from '~/utils/icons'
import { YOUTRUST_INTEREST_OPTIONS } from '#shared/constants'
import { PROPOSAL_STRATEGIES } from '#shared/schemas/ai'
import type { ProposalResult } from '#shared/schemas/ai'

const props = defineProps<{
  proposal: ProposalResult | null
  copied: boolean
  regenerating?: boolean
  isFlexy?: boolean
  isYoutrust?: boolean
  isOther?: boolean
  messageLength?: 'short' | 'long'
}>()
const emit = defineEmits<{
  copy: []
  apply: []
  back: []
  regenerate: [strategy: string]
  'update:messageLength': ['short' | 'long']
}>()

const showApplyConfirm = ref(false)
const regenStrategy = ref<string>('')
const isInterest = computed(
  () =>
    props.isFlexy ||
    props.isYoutrust ||
    props.proposal?.documentType === 'interest_message' ||
    props.proposal?.documentType === 'youtrust_message' ||
    props.proposal?.documentType === 'short_message',
)
const title = computed(() => {
  if (props.isYoutrust || props.proposal?.documentType === 'youtrust_message') return '応募の一言'
  if (isInterest.value && props.isFlexy) return '応募希望メッセージ'
  if (props.proposal?.documentType === 'short_message') return '応募メッセージ（短文）'
  return '提案文'
})
const charCount = computed(
  () => props.proposal?.messageCharacterCount ?? props.proposal?.body?.length ?? 0,
)
const interestLabel = computed(() => {
  const t = props.proposal?.recommendedInterestTarget
  return t ? YOUTRUST_INTEREST_OPTIONS[t] : null
})
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 診断結果に戻る</button>
    <h1 class="cb-h1">{{ title }}</h1>

    <template v-if="!proposal">
      <p>生成に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div v-if="isOther" class="cb-card mb-2">
        <p class="mb-2 text-[11px] font-semibold text-slate-500">文の長さ</p>
        <div class="flex gap-2">
          <button
            class="cb-outline-btn mb-0 flex-1"
            :class="messageLength === 'short' ? 'border-blue-500 text-blue-600' : ''"
            @click="emit('update:messageLength', 'short'); emit('regenerate', '')"
          >
            短文
          </button>
          <button
            class="cb-outline-btn mb-0 flex-1"
            :class="messageLength !== 'short' ? 'border-blue-500 text-blue-600' : ''"
            @click="emit('update:messageLength', 'long'); emit('regenerate', '')"
          >
            長文
          </button>
        </div>
      </div>

      <div class="cb-card mb-2.5 border border-blue-200 bg-blue-50">
        <div class="flex items-center gap-1.5">
          <CbIcon :d="Icons.zap" :size="16" color="#3b82f6" />
          <p class="m-0 text-[13px] font-bold text-blue-700">{{ proposal.strategy }}</p>
        </div>
        <p class="m-0 mt-1 text-xs text-slate-500">{{ proposal.strategyReason }}</p>
        <p v-if="interestLabel" class="m-0 mt-1 text-xs font-semibold text-blue-700">
          推奨興味対象: {{ interestLabel }}
        </p>
      </div>

      <div class="cb-card mb-2.5">
        <p class="m-0 whitespace-pre-wrap text-[13px] leading-loose text-slate-700">{{ proposal.body }}</p>
        <p class="m-0 mt-2 text-right text-[11px] text-slate-400">{{ charCount }}字</p>
        <p
          v-if="isYoutrust && charCount > 200"
          class="m-0 mt-1 text-right text-[11px] text-red-600"
        >
          YouTrustは200字以内である必要があります
        </p>
      </div>

      <div v-if="proposal.evidenceUsed?.length" class="cb-card mb-2">
        <p class="mb-1 text-[11px] font-semibold text-slate-500">採用したプロフィール根拠</p>
        <p
          v-for="(e, i) in proposal.evidenceUsed"
          :key="i"
          class="my-0.5 text-xs text-slate-700"
        >• {{ e }}</p>
      </div>

      <div
        v-for="(block, i) in [
          [proposal.assumptions, '見積り前提', '#64748b'],
          [proposal.preQuestions, isInterest ? '確認事項' : '応募前の確認質問', '#7c3aed'],
          [proposal.meetingTopics, isInterest ? '面談準備' : '面談で聞くべきこと', '#0369a1'],
        ] as const"
        :key="i"
      >
        <div v-if="(block[0] as string[])?.length" class="cb-card mb-1.5">
          <p class="mb-1 text-[11px] font-semibold" :style="{ color: block[2] }">{{ block[1] }}</p>
          <p
            v-for="(q, j) in block[0] as string[]"
            :key="j"
            class="my-0.5 text-xs text-slate-700"
          >• {{ q }}</p>
        </div>
      </div>

      <div v-if="!isInterest" class="cb-card mb-2">
        <p class="mb-2 text-[11px] font-semibold text-slate-500">別の型で再生成（利用枠を消費）</p>
        <select v-model="regenStrategy" class="cb-input">
          <option value="">型を選択...</option>
          <option v-for="s in PROPOSAL_STRATEGIES" :key="s" :value="s" :disabled="s === proposal.strategy">
            {{ s }}
          </option>
        </select>
        <button
          class="cb-outline-btn mt-0"
          :disabled="!regenStrategy || regenerating"
          @click="emit('regenerate', regenStrategy)"
        >
          {{ regenerating ? '再生成中...' : 'この型で再生成' }}
        </button>
      </div>

      <button class="cb-cta bg-green-600" @click="$emit('copy')">
        <CbIcon :d="Icons.copy" :size="16" color="#fff" />
        {{ copied ? 'コピーしました' : (isInterest ? 'メッセージをコピー' : '提案文をコピー') }}
      </button>
      <button class="cb-outline-btn" @click="showApplyConfirm = true">
        {{ isYoutrust || proposal.documentType === 'youtrust_message' ? '送信済みとして記録する' : '応募済みとして記録する' }}
      </button>
      <p class="mt-2 text-center text-[11px] text-slate-400">コピーだけでは応募済みになりません</p>

      <div v-if="showApplyConfirm" class="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div class="w-full max-w-[400px] rounded-2xl bg-white p-5">
          <p class="m-0 text-[15px] font-bold text-slate-900">実際に送信・応募しましたか？</p>
          <p class="mt-2 text-[13px] leading-relaxed text-slate-500">
            プラットフォームへ送信した場合のみ記録してください。コピーしただけではまだ応募していません。
          </p>
          <button class="cb-cta" @click="showApplyConfirm = false; emit('apply')">はい、記録する</button>
          <button class="cb-outline-btn" @click="showApplyConfirm = false">まだ送信していない</button>
        </div>
      </div>
    </template>
  </div>
</template>
