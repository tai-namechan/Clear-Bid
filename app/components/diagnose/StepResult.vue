<script setup lang="ts">
import { AXIS_LABELS, RATINGS, REC } from '#shared/constants'
import type { DiagnosisResult } from '#shared/schemas/ai'

defineProps<{
  diag: DiagnosisResult | null
}>()
defineEmits<{ gen: []; skip: []; back: [] }>()
</script>

<template>
  <div class="cb-page">
    <button class="cb-back" @click="$emit('back')">← 安全・工数に戻る</button>
    <h1 class="cb-h1">診断結果</h1>

    <template v-if="!diag">
      <p>診断に失敗しました。</p>
      <button class="cb-outline-btn" @click="$emit('back')">戻る</button>
    </template>

    <template v-else>
      <div
        class="cb-card mb-2.5"
        :style="{
          background: (REC[diag.recommendation] || REC.question).bg,
          border: `1.5px solid ${(REC[diag.recommendation] || REC.question).c}`,
        }"
      >
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full"
            :style="{ background: (REC[diag.recommendation] || REC.question).c + '20' }"
          >
            <span
              class="text-base font-extrabold"
              :style="{ color: (REC[diag.recommendation] || REC.question).c }"
            >{{ (REC[diag.recommendation] || REC.question).ic }}</span>
          </div>
          <p
            class="m-0 text-base font-extrabold"
            :style="{ color: (REC[diag.recommendation] || REC.question).c }"
          >{{ (REC[diag.recommendation] || REC.question).t }}</p>
        </div>
        <p class="mt-2 text-[13px] leading-relaxed text-slate-700">{{ diag.recommendationReason }}</p>
      </div>

      <div v-if="diag.preQuestions?.length" class="cb-card mb-2 border-l-[3px] border-l-violet-500">
        <p class="mb-1 text-[11px] font-semibold text-violet-600">応募前に確認すべきこと</p>
        <p
          v-for="(q, i) in diag.preQuestions"
          :key="i"
          class="my-1 text-xs leading-snug text-slate-700"
        >• {{ q }}</p>
      </div>

      <div v-for="(ax, i) in diag.axes" :key="i" class="cb-card mb-1.5">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[13px] font-bold text-slate-900">
            {{ (AXIS_LABELS[ax.axis as keyof typeof AXIS_LABELS] || { n: ax.axis }).n }}
          </span>
          <span
            class="rounded-lg border px-2 py-0.5 text-[10px] font-bold"
            :style="{
              color: (RATINGS[ax.rating] || RATINGS.unknown).c,
              background: (RATINGS[ax.rating] || RATINGS.unknown).bg,
              borderColor: (RATINGS[ax.rating] || RATINGS.unknown).c + '20',
            }"
          >{{ (RATINGS[ax.rating] || RATINGS.unknown).l }}</span>
        </div>
        <p class="mb-1 text-[11px] text-slate-500">
          {{ (AXIS_LABELS[ax.axis as keyof typeof AXIS_LABELS] || { d: '' }).d }}
        </p>
        <p v-for="(f, j) in ax.facts" :key="j" class="my-0.5 text-xs leading-snug text-slate-600">• {{ f }}</p>
        <p class="mt-1 text-xs leading-snug text-slate-500">{{ ax.reason }}</p>
        <p v-if="ax.missing?.length" class="mt-1 text-[11px] text-amber-600">
          ⚠ 不足: {{ ax.missing.join('、') }}
        </p>
      </div>

      <div v-if="diag.clientIntent" class="cb-card mb-2 bg-slate-50">
        <p class="mb-1.5 text-[11px] font-semibold text-slate-500">発注者の意図（AI推定）</p>
        <p v-if="diag.clientIntent.underlyingProblem" class="my-0.5 text-xs leading-snug text-slate-700">
          <span class="font-semibold text-slate-500">課題:</span> {{ diag.clientIntent.underlyingProblem }}
        </p>
        <p v-if="diag.clientIntent.selectionPriority" class="my-0.5 text-xs leading-snug text-slate-700">
          <span class="font-semibold text-slate-500">重視:</span> {{ diag.clientIntent.selectionPriority }}
        </p>
        <p v-if="diag.clientIntent.concerns" class="my-0.5 text-xs leading-snug text-slate-700">
          <span class="font-semibold text-slate-500">不安:</span> {{ diag.clientIntent.concerns }}
        </p>
      </div>

      <button class="cb-cta" @click="$emit('gen')">提案文を作る</button>
      <button
        v-if="diag.recommendation === 'skip'"
        class="cb-outline-btn"
        @click="$emit('skip')"
      >
        見送る
      </button>
    </template>
  </div>
</template>
