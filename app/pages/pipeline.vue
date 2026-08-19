<script setup lang="ts">
import { PIPELINE_FILTERS, PIPELINE_FILTER_LABELS } from '#shared/constants'
import { Icons } from '~/utils/icons'

const { pipeline } = useClearBidStore()
const filter = ref<(typeof PIPELINE_FILTERS)[number]>('all')

const items = computed(() =>
  filter.value === 'all' ? pipeline.value : pipeline.value.filter((p) => p.status === filter.value),
)
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">案件パイプライン</h1>
    <p class="cb-lead">状態と次の一手が見える一覧です。</p>
    <div class="mb-4 flex gap-1.5 overflow-x-auto pb-1 lg:flex-wrap">
      <button
        v-for="f in PIPELINE_FILTERS"
        :key="f"
        class="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] lg:text-xs"
        :class="filter === f
          ? 'bg-slate-900 font-semibold text-white'
          : 'border border-slate-200 bg-white font-normal text-slate-500'"
        @click="filter = f"
      >
        {{ PIPELINE_FILTER_LABELS[f] }}
      </button>
    </div>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink v-for="it in items" :key="it.id" :to="`/pipeline/${it.id}`" class="block no-underline">
        <PipelinePipeCard :item="it" />
      </NuxtLink>
    </div>
    <div v-if="items.length === 0" class="mt-16 text-center">
      <CbIcon :d="Icons.grid" :size="32" color="#e2e8f0" />
      <p class="mt-2 text-[13px] text-slate-400">該当する案件はありません</p>
    </div>
  </div>
</template>
