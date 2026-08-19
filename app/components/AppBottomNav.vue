<script setup lang="ts">
import { Icons } from '~/utils/icons'
import { APP_TABS } from '~/utils/nav'

const route = useRoute()

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,12px)] pt-1.5 backdrop-blur-md lg:hidden"
  >
    <NuxtLink
      v-for="tab in APP_TABS"
      :key="tab.id"
      :to="tab.to"
      class="flex min-w-[64px] flex-col items-center px-3 py-1"
      :class="isActive(tab.to) ? 'text-blue-600' : 'text-slate-400'"
    >
      <CbIcon
        :d="Icons[tab.icon]"
        :size="22"
        :color="isActive(tab.to) ? '#2563eb' : '#94a3b8'"
        :sw="isActive(tab.to) ? 2.2 : 1.8"
      />
      <span
        class="mt-0.5 text-[10px]"
        :class="isActive(tab.to) ? 'font-bold' : 'font-normal'"
      >{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
