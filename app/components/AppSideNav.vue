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
  <aside class="relative hidden h-full w-[240px] shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white/90 backdrop-blur-sm lg:sticky lg:top-0 lg:flex xl:w-[260px]">
    <div class="relative z-10 border-b border-slate-100 px-6 py-7">
      <p class="m-0 text-xs font-extrabold tracking-[0.22em] text-blue-600">CLEAR BID</p>
      <p class="mt-2 text-sm font-semibold leading-snug text-slate-900">取るべき案件を、クリアに。</p>
    </div>
    <nav class="relative z-10 flex flex-col gap-1 px-3 py-4">
      <NuxtLink
        v-for="tab in APP_TABS"
        :key="tab.id"
        :to="tab.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition"
        :class="isActive(tab.to)
          ? 'bg-blue-50 font-bold text-blue-700'
          : 'font-medium text-slate-600 hover:bg-white/70'"
      >
        <CbIcon
          :d="Icons[tab.icon]"
          :size="18"
          :color="isActive(tab.to) ? '#2563eb' : '#64748b'"
          :sw="isActive(tab.to) ? 2.2 : 1.8"
        />
        {{ tab.label }}
      </NuxtLink>
    </nav>
    <div class="relative mt-auto min-h-[180px] flex-1">
      <img
        src="/images/cb-sidebar-art.png"
        alt=""
        class="absolute inset-0 h-full w-full object-cover object-bottom"
      >
      <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white" />
    </div>
  </aside>
</template>
