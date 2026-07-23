<script setup lang="ts">
import { Icons } from '~/utils/icons'

const { pipeline } = useClearBidStore()
const filter = ref('all')

const fs = ['all', 'applied', 'replied', 'interview', 'won', 'skipped', 'lost'] as const
const fl: Record<string, string> = {
  all: 'すべて',
  applied: '応募済み',
  replied: '返信あり',
  interview: '面談',
  won: '受注',
  skipped: '見送り',
  lost: '失注',
}

const items = computed(() =>
  filter.value === 'all' ? pipeline.value : pipeline.value.filter((p) => p.status === filter.value),
)
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">案件パイプライン</h1>
    <div class="mb-3 flex gap-1.5 overflow-x-auto pb-1">
      <button
        v-for="f in fs"
        :key="f"
        class="whitespace-nowrap rounded-2xl px-3 py-1.5 text-[11px]"
        :class="filter === f
          ? 'bg-slate-900 font-semibold text-white'
          : 'border border-slate-200 bg-white font-normal text-slate-500'"
        @click="filter = f"
      >
        {{ fl[f] }}
      </button>
    </div>
    <PipelinePipeCard v-for="it in items" :key="it.id" :item="it" />
    <div v-if="items.length === 0" class="mt-10 text-center">
      <CbIcon :d="Icons.grid" :size="32" color="#e2e8f0" />
      <p class="mt-2 text-[13px] text-slate-400">該当する案件はありません</p>
    </div>
  </div>
</template>
