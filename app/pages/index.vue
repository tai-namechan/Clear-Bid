<script setup lang="ts">
import { Icons } from '~/utils/icons'
import { buildNextActions } from '#shared/domain/pipeline'

const { profile, pipeline, stats } = useClearBidStore()
const router = useRouter()

const recent = computed(() => pipeline.value.slice(0, 6))
const hasData = computed(() => stats.value.diagnosed > 0 || stats.value.applied > 0)
const nextActions = computed(() =>
  buildNextActions(pipeline.value).filter(
    (a): a is Extract<ReturnType<typeof buildNextActions>[number], { opportunityId: string }> =>
      'opportunityId' in a,
  ),
)

function onStart() {
  router.push('/diagnose?reset=1')
}

const flow = [
  ['募集文を貼り付ける', '案件タイトルと募集文をコピペ', Icons.file],
  ['AIが構造化・安全チェック', '地雷を検出し、工数を3点見積り', Icons.shield],
  ['5軸で診断', '安全性・適合度・完遂可能性・採算性・受注可能性', Icons.check],
  ['提案文を生成', '1通だけ、最適な型で', Icons.zap],
] as const
</script>

<template>
  <div class="cb-page">
    <header class="mb-6 lg:mb-8">
      <p class="m-0 text-xs font-extrabold tracking-[0.2em] text-blue-600 lg:hidden">CLEAR BID</p>
      <h1 class="cb-h1 mt-1 lg:mt-0">取るべき案件を、クリアに。</h1>
      <p class="cb-lead mb-0">募集文を貼るだけで、応募するか見送るかを先に判断できます。</p>
    </header>

    <div v-if="!hasData" class="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
      <div class="cb-card border-none bg-gradient-to-br from-blue-50 to-emerald-50 px-6 py-8 text-center lg:col-span-7 lg:px-8 lg:py-10 lg:text-left">
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(37,99,235,0.15)] lg:mx-0"
        >
          <CbIcon :d="Icons.shield" :size="28" color="#2563eb" />
        </div>
        <p class="mb-1.5 text-lg font-bold text-slate-900 lg:text-xl">はじめましょう</p>
        <p class="m-0 text-[13px] leading-relaxed text-slate-600 lg:max-w-md lg:text-sm">
          安全性・工数・採算を確認してから、提案文は1通だけ作ります。
        </p>
        <div class="cb-actions mt-6">
          <button
            v-if="!profile.name"
            class="cb-outline-btn"
            @click="router.push('/profile')"
          >
            まず稼働条件を登録する
          </button>
          <button class="cb-cta" @click="onStart">最初の案件を診断する</button>
        </div>
      </div>

      <div class="mt-6 lg:col-span-5 lg:mt-0">
        <p class="cb-section-title">Clear Bidの流れ</p>
        <div class="space-y-3">
          <div
            v-for="(row, i) in flow"
            :key="i"
            class="cb-card mb-0 flex items-start gap-3"
          >
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <CbIcon :d="row[2]" :size="16" color="#2563eb" />
            </div>
            <div>
              <p class="m-0 text-[13px] font-semibold text-slate-900">{{ row[0] }}</p>
              <p class="m-0 mt-0.5 text-xs text-slate-400">{{ row[1] }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div class="lg:col-span-7">
          <div v-if="nextActions.length" class="mb-6">
            <p class="cb-section-title">次にやること</p>
            <button
              v-for="(a, i) in nextActions"
              :key="i"
              class="cb-card mb-2 flex w-full cursor-pointer items-center justify-between border-blue-100 text-left transition hover:border-blue-300"
              @click="router.push(`/pipeline/${a.opportunityId}`)"
            >
              <div>
                <p class="m-0 text-[13px] font-semibold text-slate-900 lg:text-sm">{{ a.label }}</p>
                <p class="m-0 mt-0.5 text-xs text-slate-400">{{ a.title }}</p>
              </div>
              <CbIcon :d="Icons.chevron" :size="16" color="#94a3b8" />
            </button>
          </div>

          <div class="cb-actions mb-6">
            <button class="cb-cta mt-0" @click="onStart">
              <CbIcon :d="Icons.search" :size="18" color="#fff" />
              <span>案件を診断する</span>
            </button>
          </div>

          <template v-if="recent.length">
            <div class="mb-3 flex items-center justify-between">
              <p class="cb-section-title mb-0">最近の案件</p>
              <button class="cb-link" @click="router.push('/pipeline')">
                すべて見る
                <CbIcon :d="Icons.chevron" :size="14" color="#2563eb" />
              </button>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <NuxtLink v-for="it in recent" :key="it.id" :to="`/pipeline/${it.id}`" class="block no-underline">
                <PipelinePipeCard :item="it" />
              </NuxtLink>
            </div>
          </template>
        </div>

        <div class="mt-8 lg:col-span-5 lg:mt-0">
          <p class="cb-section-title">今月のサマリー</p>
          <div
            v-if="stats.contractTotal > 0"
            class="cb-card mb-4 border border-green-200 bg-gradient-to-br from-emerald-50 to-white"
          >
            <p class="m-0 text-xs text-slate-500">契約額（税引前手取り見込み）</p>
            <p class="my-1.5 text-[28px] font-extrabold tabular-nums text-green-700 lg:text-4xl">
              ¥{{ stats.contractTotal.toLocaleString() }}
            </p>
            <p v-if="stats.paidTotal > 0" class="m-0 text-xs text-slate-500">
              入金済み ¥{{ stats.paidTotal.toLocaleString() }}
            </p>
          </div>
          <div class="cb-grid-3">
            <HomeStatCard :icon="Icons.search" label="診断" :value="stats.diagnosed" />
            <HomeStatCard :icon="Icons.file" label="応募" :value="stats.applied" />
            <HomeStatCard
              :icon="Icons.trend"
              label="返信"
              :value="stats.applied ? `${stats.replied}/${stats.applied}` : '─'"
              :sub="stats.applied >= 5 ? `${Math.round((stats.replied / stats.applied) * 100)}%` : null"
            />
            <HomeStatCard
              :icon="Icons.check"
              label="受注"
              :value="stats.applied ? `${stats.won}/${stats.applied}` : '─'"
            />
            <HomeStatCard :icon="Icons.shield" label="見送り" :value="stats.skipped" />
            <HomeStatCard
              :icon="Icons.dollar"
              label="入金"
              :value="stats.paidTotal ? `¥${(stats.paidTotal / 1000).toFixed(0)}k` : '─'"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
