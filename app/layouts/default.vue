<script setup lang="ts">
const { ready, init } = useClearBidStore()

onMounted(() => {
  init()
})
</script>

<template>
  <div class="cb-shell">
    <div v-if="!ready" class="flex h-screen items-center justify-center">
      <div class="cb-spinner" />
    </div>
    <template v-else>
      <div class="flex-1 overflow-y-auto pb-[72px]">
        <slot />
      </div>
      <AppBottomNav />
    </template>
  </div>
</template>
