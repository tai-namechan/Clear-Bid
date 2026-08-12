<script setup lang="ts">
const route = useRoute()
const { ready, init, resetLocalState } = useClearBidStore()
const { refresh, user, ready: authReady } = useAuth()
const bootError = ref('')

onMounted(async () => {
  bootError.value = ''
  try {
    await refresh()
    if (route.path === '/login') {
      return
    }
    if (!user.value) return
    await init()
  } catch (e) {
    bootError.value = e instanceof Error ? e.message : '初期化に失敗しました'
    resetLocalState()
  }
})

watch(
  () => user.value?.id,
  async (id, prev) => {
    if (route.path === '/login') return
    if (id && id !== prev) {
      resetLocalState()
      try {
        await init()
      } catch (e) {
        bootError.value = e instanceof Error ? e.message : '初期化に失敗しました'
      }
    }
  },
)
</script>

<template>
  <div class="cb-shell">
    <div v-if="route.path === '/login'" class="flex-1 overflow-y-auto">
      <slot />
    </div>
    <div v-else-if="bootError" class="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p class="text-sm text-red-600">{{ bootError }}</p>
      <NuxtLink class="text-xs font-semibold text-blue-600" to="/login">ログインへ</NuxtLink>
    </div>
    <div v-else-if="!authReady || !ready" class="flex h-screen items-center justify-center">
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
