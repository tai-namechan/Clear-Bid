<script setup lang="ts">
import { REC, STATUSES, PLATFORMS } from '#shared/constants'
import type { PipelineItem } from '#shared/types'

defineProps<{
  item: PipelineItem
}>()
</script>

<template>
  <div class="cb-card mt-2">
    <div class="mb-1 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          :style="{
            background: (STATUSES[item.status]?.c || '#94a3b8') + '18',
            color: STATUSES[item.status]?.c || '#94a3b8',
          }"
        >{{ STATUSES[item.status]?.l || item.status }}</span>
        <span
          v-if="item.recommendation && REC[item.recommendation]"
          class="text-[10px] font-semibold"
          :style="{ color: REC[item.recommendation].c }"
        >{{ REC[item.recommendation].t }}</span>
      </div>
      <span class="text-[11px] text-slate-400">{{ item.date }}</span>
    </div>
    <p class="my-1 text-[13px] font-semibold leading-snug text-slate-900">{{ item.title }}</p>
    <div class="flex items-center justify-between">
      <span class="text-[11px] text-slate-400">
        {{ PLATFORMS[item.platform] || item.platform }}{{ item.strategy ? ` · ${item.strategy}` : '' }}
      </span>
      <span v-if="item.budgetMin" class="text-xs font-semibold text-slate-900">
        ¥{{ Number(item.budgetMin).toLocaleString() }}
      </span>
    </div>
  </div>
</template>
