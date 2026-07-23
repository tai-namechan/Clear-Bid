<script setup lang="ts">
import type { UserProfile } from '#shared/types'

const { profile, saveProfile } = useClearBidStore()
const p = ref<UserProfile>({ ...profile.value })
const ok = ref(false)
const ns = ref('')
const na = ref({ title: '', result: '' })
const nn = ref('')

watch(profile, (v) => {
  p.value = { ...v, skills: [...(v.skills || [])], achievements: [...(v.achievements || [])], ngConditions: [...(v.ngConditions || [])] }
}, { immediate: true })

function u<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
  p.value = { ...p.value, [k]: v }
}

async function doSave() {
  await saveProfile(p.value)
  ok.value = true
  setTimeout(() => {
    ok.value = false
  }, 2000)
}

function addSkill() {
  if (!ns.value.trim()) return
  u('skills', [...p.value.skills, { name: ns.value.trim(), level: '実務', usableInProposal: true }])
  ns.value = ''
}

function addAchievement() {
  if (!na.value.title.trim()) return
  u('achievements', [...p.value.achievements, { ...na.value, usableInProposal: true }])
  na.value = { title: '', result: '' }
}

function addNg() {
  if (!nn.value.trim()) return
  u('ngConditions', [...p.value.ngConditions, nn.value.trim()])
  nn.value = ''
}
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">自分</h1>
    <p class="mb-4 text-xs text-slate-500">稼働条件と実績を登録すると、診断と提案文の精度が上がります。</p>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">基本情報</p>
      <label class="cb-label">名前（提案文での名乗り）</label>
      <input class="cb-input" :value="p.name" placeholder="佐藤ユウキ" @input="u('name', ($event.target as HTMLInputElement).value)">
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">稼働条件</p>
      <div class="grid grid-cols-2 gap-1.5">
        <div>
          <label class="cb-label">週の稼働時間</label>
          <input class="cb-input" type="number" :value="p.weeklyHours" @input="u('weeklyHours', Number(($event.target as HTMLInputElement).value))">
        </div>
        <div>
          <label class="cb-label">最低希望時給(¥)</label>
          <input class="cb-input" type="number" :value="p.minHourlyYen" @input="u('minHourlyYen', Number(($event.target as HTMLInputElement).value))">
        </div>
      </div>
      <label class="cb-label">対応可能時間帯</label>
      <input class="cb-input" :value="p.availableTimes" @input="u('availableTimes', ($event.target as HTMLInputElement).value)">
      <label class="cb-label">MTG上限</label>
      <input class="cb-input" :value="p.mtgLimit" @input="u('mtgLimit', ($event.target as HTMLInputElement).value)">
      <label class="cb-label">受注余力</label>
      <input class="cb-input" :value="p.capacity" @input="u('capacity', ($event.target as HTMLInputElement).value)">
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">スキル</p>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(s, i) in p.skills"
          :key="i"
          class="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
        >
          {{ s.name }}
          <button
            class="border-none bg-transparent p-0 text-sm leading-none text-blue-300"
            @click="u('skills', p.skills.filter((_, j) => j !== i))"
          >×</button>
        </span>
      </div>
      <div class="flex gap-1.5">
        <input
          class="cb-input mb-0 flex-1"
          :value="ns"
          placeholder="スキル名"
          @input="ns = ($event.target as HTMLInputElement).value"
          @keydown.enter="addSkill"
        >
        <button
          class="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-500"
          @click="addSkill"
        >
          追加
        </button>
      </div>
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">実績</p>
      <div
        v-for="(a, i) in p.achievements"
        :key="i"
        class="cb-card mb-1.5 flex items-start justify-between"
      >
        <div>
          <p class="m-0 text-xs font-semibold text-slate-700">{{ a.title }}</p>
          <p v-if="a.result" class="m-0 mt-0.5 text-[11px] text-slate-500">{{ a.result }}</p>
        </div>
        <button
          class="border-none bg-transparent text-sm text-slate-300"
          @click="u('achievements', p.achievements.filter((_, j) => j !== i))"
        >×</button>
      </div>
      <input class="cb-input" :value="na.title" placeholder="実績タイトル" @input="na = { ...na, title: ($event.target as HTMLInputElement).value }">
      <input class="cb-input" :value="na.result" placeholder="成果（数字入り）" @input="na = { ...na, result: ($event.target as HTMLInputElement).value }">
      <button class="cb-outline-btn" @click="addAchievement">実績を追加</button>
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">NG条件</p>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(ng, i) in p.ngConditions"
          :key="i"
          class="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs text-red-600"
        >
          {{ ng }}
          <button
            class="border-none bg-transparent p-0 text-sm leading-none text-red-300"
            @click="u('ngConditions', p.ngConditions.filter((_, j) => j !== i))"
          >×</button>
        </span>
      </div>
      <div class="flex gap-1.5">
        <input
          class="cb-input mb-0 flex-1"
          :value="nn"
          placeholder="例: 保守運用込み"
          @input="nn = ($event.target as HTMLInputElement).value"
          @keydown.enter="addNg"
        >
        <button
          class="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-500"
          @click="addNg"
        >
          追加
        </button>
      </div>
    </section>

    <button class="cb-cta mt-4" @click="doSave">{{ ok ? '✓ 保存しました' : '保存' }}</button>
  </div>
</template>
