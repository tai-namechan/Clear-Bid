<script setup lang="ts">
const { ready, init } = useClearBidStore()

onMounted(() => {
  init()
})
</script>

<template>
  <div class="cb-app">
    <div v-if="!ready" class="flex h-screen w-full items-center justify-center">
      <div class="cb-spinner" />
    </div>
    <template v-else>
      <AppSideNav />
      <div class="cb-main">
        <slot />
      </div>
      <AppBottomNav />
    </template>
  </div>
</template>
