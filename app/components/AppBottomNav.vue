<script setup lang="ts">
const route = useRoute()

const tabs = [
  { id: 'index', to: '/', label: 'ホーム', icon: 'home' },
  { id: 'diagnose', to: '/diagnose', label: '診断', icon: 'search' },
  { id: 'pipeline', to: '/pipeline', label: '案件', icon: 'grid' },
  { id: 'profile', to: '/profile', label: '自分', icon: 'user' },
] as const

import { Icons } from '~/utils/icons'

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t border-slate-200 bg-white/97 pb-[env(safe-area-inset-bottom,16px)] pt-1.5 backdrop-blur-md"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.id"
      :to="tab.to"
      class="flex flex-col items-center px-4 py-1"
      :style="{ color: isActive(tab.to) ? '#3b82f6' : '#94a3b8' }"
    >
      <CbIcon
        :d="Icons[tab.icon]"
        :size="22"
        :color="isActive(tab.to) ? '#3b82f6' : '#94a3b8'"
        :sw="isActive(tab.to) ? 2.2 : 1.8"
      />
      <span
        class="mt-0.5 text-[10px]"
        :class="isActive(tab.to) ? 'font-bold' : 'font-normal'"
      >{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
