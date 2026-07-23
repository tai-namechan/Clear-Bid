<script setup lang="ts">
import { Icons } from '~/utils/icons'

const { profile, pipeline, stats } = useClearBidStore()
const router = useRouter()

const recent = computed(() => pipeline.value.slice(0, 3))
const hasData = computed(() => stats.value.diagnosed > 0 || stats.value.applied > 0)

function onStart() {
  router.push('/diagnose?reset=1')
}
</script>

<template>
  <div class="cb-page">
    <div class="flex items-start justify-between">
      <div>
        <p class="m-0 text-xs font-extrabold tracking-[3px] text-blue-500">CLEAR BID</p>
        <h1 class="m-0 mt-0.5 text-[21px] font-extrabold tracking-tight text-slate-900">
          取るべき案件を、クリアに。
        </h1>
      </div>
    </div>

    <div v-if="!hasData" class="mt-5">
      <div
        class="rounded-[14px] border-none px-6 py-6 text-center"
        style="background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)"
      >
        <div
          class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(59,130,246,0.15)]"
        >
          <CbIcon :d="Icons.shield" :size="28" color="#3b82f6" />
        </div>
        <p class="mb-1.5 text-base font-bold text-slate-900">はじめましょう</p>
        <p class="m-0 text-[13px] leading-relaxed text-slate-500">募集文を貼り付けるだけで、</p>
        <p class="mb-4 text-[13px] leading-relaxed text-slate-500">安全性・工数・採算をチェックできます。</p>
        <button
          v-if="!profile.name"
          class="cb-outline-btn mb-2"
          @click="router.push('/profile')"
        >
          まず稼働条件を登録する
        </button>
        <button class="cb-cta" @click="onStart">最初の案件を診断する</button>
      </div>

      <div class="mt-4">
        <p class="mb-2 text-[13px] font-semibold text-slate-500">Clear Bidの流れ</p>
        <div
          v-for="(row, i) in [
            ['募集文を貼り付ける', '案件タイトルと募集文をコピペ', Icons.file],
            ['AIが構造化・安全チェック', '地雷を検出し、工数を3点見積り', Icons.shield],
            ['5軸で診断', '安全性・適合度・完遂可能性・採算性・受注可能性', Icons.check],
            ['提案文を生成', '1通だけ、最適な型で', Icons.zap],
          ]"
          :key="i"
          class="mb-3 flex items-start gap-3"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <CbIcon :d="row[2]" :size="16" color="#3b82f6" />
          </div>
          <div>
            <p class="m-0 text-[13px] font-semibold text-slate-900">{{ row[0] }}</p>
            <p class="m-0 mt-0.5 text-xs text-slate-400">{{ row[1] }}</p>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <p class="my-2 text-xs text-slate-400">今月のサマリー</p>

      <div
        v-if="stats.contractTotal > 0"
        class="cb-card mb-3 border border-green-200"
        style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
      >
        <p class="m-0 text-xs text-slate-500">契約額（税引前手取り見込み）</p>
        <p class="my-1.5 text-[30px] font-extrabold tabular-nums text-green-600">
          ¥{{ stats.contractTotal.toLocaleString() }}
        </p>
        <p v-if="stats.paidTotal > 0" class="m-0 text-xs text-slate-500">
          入金済み ¥{{ stats.paidTotal.toLocaleString() }}
        </p>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <HomeStatCard :icon="Icons.search" label="診断" :value="stats.diagnosed" />
        <HomeStatCard :icon="Icons.file" label="応募" :value="stats.applied" />
        <HomeStatCard
          :icon="Icons.trend"
          label="返信"
          :value="stats.applied ? `${stats.replied}/${stats.applied}` : '─'"
          :sub="stats.applied >= 5 ? `${Math.round((stats.replied / stats.applied) * 100)}%` : null"
        />
      </div>
      <div class="mt-2 grid grid-cols-3 gap-2">
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

      <button class="cb-cta mt-4" @click="onStart">
        <CbIcon :d="Icons.search" :size="18" color="#fff" />
        <span>案件を診断する</span>
      </button>

      <template v-if="recent.length">
        <div class="mt-5 flex items-center justify-between">
          <p class="m-0 text-sm font-bold text-slate-900">最近の案件</p>
          <button class="cb-link" @click="router.push('/pipeline')">
            すべて見る
            <CbIcon :d="Icons.chevron" :size="14" color="#3b82f6" />
          </button>
        </div>
        <PipelinePipeCard v-for="it in recent" :key="it.id" :item="it" />
      </template>
    </template>
  </div>
</template>
