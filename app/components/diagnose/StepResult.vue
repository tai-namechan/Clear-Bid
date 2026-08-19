<script setup lang="ts">
import {
  APPLICATION_PRIORITIES,
  AXIS_LABELS,
  RATINGS,
  REC,
  RECOMMENDED_ACTIONS,
  REQUIREMENT_EVIDENCE_LABELS,
  REQUIREMENT_MATCH_LABELS,
} from '#shared/constants'
import type { DiagnosisResult, ExtractionResult } from '#shared/schemas/ai'
import type { JobInput, RequirementEvidence } from '#shared/types'

const props = defineProps<{
  diag: DiagnosisResult | null
  isFlexy?: boolean
  isYoutrust?: boolean
  extraction?: ExtractionResult | null
  job?: JobInput | null
  evidences?: RequirementEvidence[]
  canGenerate?: boolean
}>()
defineEmits<{ gen: []; skip: []; back: [] }>()

const selfChecks = computed(() =>
  (props.diag?.preQuestions || []).filter((q) => /経験|根拠|本人|必須要件/.test(q)),
)
const consultantChecks = computed(() => {
  const qs = props.diag?.questionsToConfirm?.length
    ? props.diag.questionsToConfirm
    : (props.diag?.preQuestions || []).filter((q) => !/経験|根拠|本人|必須要件/.test(q))
  return qs.slice(0, 3)
})

const actionKey = computed(() => props.diag?.recommendedAction || null)
const actionMeta = computed(() => {
  if (!actionKey.value) return null
  return RECOMMENDED_ACTIONS[actionKey.value] || null
})
const priorityMeta = computed(() => {
  const p = props.diag?.applicationPriority
  return p ? APPLICATION_PRIORITIES[p] : null
})

const generateLabel = computed(() => {
  if (props.isYoutrust) return '応募の一言を作る'
  if (props.isFlexy) return '応募希望メッセージを作る'
  return '提案文を作る'
})
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
      <div class="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div class="lg:col-span-5">
          <div class="cb-card mb-2.5">
            <p class="mb-1.5 text-[11px] font-semibold text-slate-500">応募判断</p>
            <div
              v-if="actionMeta"
              class="mb-2 rounded-xl p-3"
              :style="{ background: actionMeta.bg, border: `1.5px solid ${actionMeta.c}` }"
            >
              <div class="flex items-center gap-2">
                <span class="text-base font-extrabold" :style="{ color: actionMeta.c }">{{ actionMeta.ic }}</span>
                <p class="m-0 text-base font-extrabold" :style="{ color: actionMeta.c }">{{ actionMeta.t }}</p>
              </div>
            </div>
            <div class="mb-2 grid grid-cols-2 gap-2">
              <div class="rounded-lg bg-slate-50 p-2">
                <p class="m-0 text-[10px] text-slate-500">応募優先度</p>
                <p class="m-0 text-sm font-bold" :style="{ color: priorityMeta?.c || '#64748b' }">
                  {{ priorityMeta?.t || '—' }}
                </p>
              </div>
              <div class="rounded-lg bg-slate-50 p-2">
                <p class="m-0 text-[10px] text-slate-500">判定ラベル</p>
                <p class="m-0 text-sm font-bold text-slate-800">{{ diag.existingLabel || '—' }}</p>
              </div>
              <div
                class="col-span-2 rounded-lg p-2"
                :style="{
                  background: (REC[diag.recommendation] || REC.question).bg,
                }"
              >
                <p class="m-0 text-[10px] text-slate-500">従来推奨</p>
                <p
                  class="m-0 text-sm font-bold"
                  :style="{ color: (REC[diag.recommendation] || REC.question).c }"
                >
                  {{ (REC[diag.recommendation] || REC.question).t }}
                </p>
              </div>
            </div>
            <p class="m-0 text-[13px] leading-relaxed text-slate-700">
              {{ diag.decisionReason || diag.recommendationReason }}
            </p>
          </div>
        </div>

        <div class="lg:col-span-7">
          <div v-if="diag.matchedExperiences?.length" class="cb-card mb-2">
            <p class="mb-1.5 text-[11px] font-semibold text-slate-500">経験との接点</p>
            <div
              v-for="(m, i) in diag.matchedExperiences.slice(0, 3)"
              :key="i"
              class="mb-1.5 border-t border-slate-100 pt-1.5"
            >
              <p class="m-0 text-xs font-semibold text-slate-800">{{ m.text }}</p>
              <p class="m-0 text-[11px] text-slate-500">根拠: {{ m.evidenceSource }}</p>
            </div>
          </div>

      <div v-if="diag.gaps?.length || diag.conditionRisks?.length" class="cb-card mb-2 border-l-[3px] border-l-amber-500">
        <p class="mb-1 text-[11px] font-semibold text-amber-700">足りない点</p>
        <p
          v-for="(g, i) in (diag.gaps || []).slice(0, 6)"
          :key="`g-${i}`"
          class="my-1 text-xs leading-snug text-slate-700"
        >• {{ g }}</p>
        <p
          v-for="(r, i) in (diag.conditionRisks || []).slice(0, 4)"
          :key="`r-${i}`"
          class="my-1 text-xs leading-snug text-slate-700"
        >• {{ r.risk }}</p>
      </div>

      <div v-if="diag.requirements?.length" class="cb-card mb-2">
        <p class="mb-1.5 text-[11px] font-semibold text-slate-500">必須・歓迎要件の分類</p>
        <div
          v-for="(req, i) in diag.requirements"
          :key="i"
          class="mb-2 border-t border-slate-100 pt-1.5"
        >
          <p class="m-0 text-xs font-semibold text-slate-800">
            {{ req.requirement }}
            <span class="ml-1 text-[10px] font-normal text-slate-400">
              {{ req.importance === 'required' ? '必須' : '歓迎' }}
            </span>
          </p>
          <p class="m-0 mt-0.5 text-[11px] text-slate-600">
            判定: {{ REQUIREMENT_MATCH_LABELS[req.status] || req.status }}
          </p>
          <p class="m-0 text-[11px] text-slate-600">根拠: {{ req.reason }}</p>
          <p class="m-0 text-[11px] text-slate-500">扱い: {{ req.howToHandle }}</p>
        </div>
      </div>

      <div v-if="isFlexy" class="cb-card mb-2">
        <p class="mb-1.5 text-[11px] font-semibold text-slate-500">案件条件</p>
        <p class="my-0.5 text-xs text-slate-700"><span class="font-semibold text-slate-500">職種:</span> {{ extraction?.role?.text || '—' }}</p>
        <p class="my-0.5 text-xs text-slate-700">
          <span class="font-semibold text-slate-500">月額報酬:</span>
          {{ job?.budgetMin || job?.budgetMax
            ? `${job?.budgetMin ? `¥${Number(job.budgetMin).toLocaleString()}` : '下限不明'} 〜 ${job?.budgetMax ? `¥${Number(job.budgetMax).toLocaleString()}` : '上限不明'}`
            : extraction?.budget?.text || '—' }}
        </p>
        <p class="my-0.5 text-xs text-slate-700"><span class="font-semibold text-slate-500">稼働日数:</span> {{ extraction?.workDays?.text || '—' }}</p>
        <p class="my-0.5 text-xs text-slate-700">
          <span class="font-semibold text-slate-500">想定月間時間:</span>
          {{ job?.expectedMonthlyHoursMin || job?.expectedMonthlyHoursMax
            ? `${job?.expectedMonthlyHoursMin || '—'}〜${job?.expectedMonthlyHoursMax || '—'}h`
            : '不明（確認事項）' }}
        </p>
        <p class="my-0.5 text-xs text-slate-700"><span class="font-semibold text-slate-500">リモート:</span> {{ extraction?.workStyle?.text || '—' }}</p>
        <p class="my-0.5 text-xs text-slate-700"><span class="font-semibold text-slate-500">対応時間帯:</span> {{ extraction?.requiredAvailability?.text || '—' }}</p>
        <p class="my-0.5 text-xs text-slate-700"><span class="font-semibold text-slate-500">勤務地:</span> {{ extraction?.workLocation?.text || '—' }}</p>
      </div>

      <div v-if="isFlexy && evidences?.length" class="cb-card mb-2">
        <p class="mb-1.5 text-[11px] font-semibold text-slate-500">必須要件エビデンス</p>
        <div v-for="(ev, i) in evidences" :key="i" class="mb-2 border-t border-slate-100 pt-1.5">
          <p class="m-0 text-xs font-semibold text-slate-800">{{ ev.requirement }}</p>
          <p class="m-0 mt-0.5 text-[11px] text-slate-600">
            状態: {{ REQUIREMENT_EVIDENCE_LABELS[ev.status] || ev.status }}
          </p>
          <p v-if="ev.evidenceNote" class="m-0 text-[11px] text-slate-600">根拠: {{ ev.evidenceNote }}</p>
          <p v-if="ev.sourceQuote" class="m-0 text-[11px] italic text-slate-400">「{{ ev.sourceQuote }}」</p>
        </div>
      </div>

      <div v-if="selfChecks.length" class="cb-card mb-2 border-l-[3px] border-l-amber-500">
        <p class="mb-1 text-[11px] font-semibold text-amber-700">本人確認</p>
        <p v-for="(q, i) in selfChecks" :key="i" class="my-1 text-xs leading-snug text-slate-700">• {{ q }}</p>
      </div>

      <div v-if="consultantChecks.length" class="cb-card mb-2 border-l-[3px] border-l-violet-500">
        <p class="mb-1 text-[11px] font-semibold text-violet-600">面談・応募前に確認すること</p>
        <p v-for="(q, i) in consultantChecks" :key="i" class="my-1 text-xs leading-snug text-slate-700">• {{ q }}</p>
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
        </div>
      </div>

      <div class="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div v-for="(ax, i) in diag.axes" :key="i" class="cb-card mb-0">
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
      </div>

      <div class="cb-actions">
      <button
        class="cb-cta"
        :disabled="canGenerate === false"
        @click="$emit('gen')"
      >
        {{ generateLabel }}
      </button>
      <p v-if="canGenerate === false" class="w-full text-[11px] text-amber-600 lg:w-auto">
        必須要件の経験有無を確認すると、実績を誇張せず応募文を作れます。
      </p>
      <button class="cb-outline-btn" @click="$emit('skip')">見送りとして記録</button>
      </div>
    </template>
  </div>
</template>
