<script setup lang="ts">
import { Icons } from '~/utils/icons'

defineProps<{
  icon: string
  label: string
  value: string | number
  sub?: string | null
}>()
</script>

<template>
  <div class="cb-card">
    <div class="mb-1.5 flex items-center gap-1">
      <CbIcon :d="icon" :size="14" color="#94a3b8" :sw="1.5" />
      <span class="text-[11px] text-slate-400">{{ label }}</span>
    </div>
    <p class="m-0 text-xl font-extrabold text-slate-900">{{ value }}</p>
    <p v-if="sub" class="m-0 mt-0.5 text-[11px] text-slate-500">{{ sub }}</p>
  </div>
</template>
