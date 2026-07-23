<script setup lang="ts">
import { Icons } from '~/utils/icons'
import { PROPOSAL_STRATEGIES } from '#shared/schemas/ai'
import type { ProposalResult } from '#shared/schemas/ai'

defineProps<{
  proposal: ProposalResult | null
  copied: boolean
  regenerating?: boolean
}>()
const emit = defineEmits<{
  copy: []
  apply: []
  back: []
  regenerate: [strategy: string]
}>()

const showApplyConfirm = ref(false)
const regenStrategy = ref<string>('')
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 診断結果に戻る</button>
    <h1 class="cb-h1">提案文</h1>

    <template v-if="!proposal">
      <p>生成に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div class="cb-card mb-2.5 border border-blue-200 bg-blue-50">
        <div class="flex items-center gap-1.5">
          <CbIcon :d="Icons.zap" :size="16" color="#3b82f6" />
          <p class="m-0 text-[13px] font-bold text-blue-700">{{ proposal.strategy }}</p>
        </div>
        <p class="m-0 mt-1 text-xs text-slate-500">{{ proposal.strategyReason }}</p>
      </div>

      <div class="cb-card mb-2.5">
        <p class="m-0 whitespace-pre-wrap text-[13px] leading-loose text-slate-700">{{ proposal.body }}</p>
        <p class="m-0 mt-2 text-right text-[11px] text-slate-400">{{ proposal.body?.length }}字</p>
      </div>

      <div
        v-for="(block, i) in [
          [proposal.assumptions, '見積り前提', '#64748b'],
          [proposal.preQuestions, '応募前の確認質問', '#7c3aed'],
          [proposal.meetingTopics, '面談で聞くべきこと', '#0369a1'],
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

      <div class="cb-card mb-2">
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
        {{ copied ? 'コピーしました' : '提案文をコピー' }}
      </button>
      <button class="cb-outline-btn" @click="showApplyConfirm = true">応募済みとして記録する</button>
      <p class="mt-2 text-center text-[11px] text-slate-400">コピーだけでは応募済みになりません</p>

      <div v-if="showApplyConfirm" class="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div class="w-full max-w-[400px] rounded-2xl bg-white p-5">
          <p class="m-0 text-[15px] font-bold text-slate-900">実際に応募しましたか？</p>
          <p class="mt-2 text-[13px] leading-relaxed text-slate-500">
            プラットフォームへ提案を送信した場合のみ「応募済み」にしてください。コピーしただけではまだ応募していません。
          </p>
          <button class="cb-cta" @click="showApplyConfirm = false; emit('apply')">はい、応募済みにする</button>
          <button class="cb-outline-btn" @click="showApplyConfirm = false">まだ応募していない</button>
        </div>
      </div>
    </template>
  </div>
</template>
