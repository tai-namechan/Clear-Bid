<script setup lang="ts">
import type { UserProfile } from '#shared/types'

import { AI_USAGE_LIMITS } from '#shared/constants'
import { currentPeriod } from '#shared/domain/usage'

const { profile, saveProfile, usage, remoteEnabled, sessionUser, exportBackup, importBackup, pipeline, resetLocalState } = useClearBidStore()
const { signOut } = useAuth()
const router = useRouter()
const p = ref<UserProfile>({ ...profile.value })
const ok = ref(false)
const ns = ref('')
const na = ref({ title: '', result: '' })
const nn = ref('')
const niTech = ref('')
const niCompany = ref('')
const niDomain = ref('')
const backupMsg = ref('')
const backupError = ref('')
const importText = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const usageCounts = computed(() => {
  const period = currentPeriod()
  const u = usage.value.period === period ? usage.value : { counts: {} as Record<string, number> }
  return {
    extract: u.counts.extract || 0,
    diagnose: u.counts.diagnose || 0,
    proposal: u.counts.proposal || 0,
    reply: u.counts.reply || 0,
  }
})

const backupSummary = computed(() => {
  const name = profile.value.name || '（名前未設定）'
  return `${name} · 案件 ${pipeline.value.length} 件`
})

watch(profile, (v) => {
  p.value = {
    ...v,
    skills: [...(v.skills || [])],
    achievements: [...(v.achievements || [])],
    ngConditions: [...(v.ngConditions || [])],
    interestAreas: {
      technologies: [...(v.interestAreas?.technologies || [])],
      companies: [...(v.interestAreas?.companies || [])],
      domains: [...(v.interestAreas?.domains || [])],
    },
  }
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

function addInterest(kind: 'technologies' | 'companies' | 'domains', raw: string) {
  const v = raw.trim()
  if (!v) return
  const areas = {
    technologies: [...(p.value.interestAreas?.technologies || [])],
    companies: [...(p.value.interestAreas?.companies || [])],
    domains: [...(p.value.interestAreas?.domains || [])],
  }
  if (!areas[kind].includes(v)) areas[kind].push(v)
  u('interestAreas', areas)
}

function removeInterest(kind: 'technologies' | 'companies' | 'domains', index: number) {
  const areas = {
    technologies: [...(p.value.interestAreas?.technologies || [])],
    companies: [...(p.value.interestAreas?.companies || [])],
    domains: [...(p.value.interestAreas?.domains || [])],
  }
  areas[kind] = areas[kind].filter((_, i) => i !== index)
  u('interestAreas', areas)
}

function downloadBackup() {
  backupError.value = ''
  backupMsg.value = ''
  try {
    const data = exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const day = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `clear-bid-backup-${day}.json`
    a.click()
    URL.revokeObjectURL(url)
    backupMsg.value = 'バックアップをダウンロードしました。このファイルをスマホへ送って取り込んでください。'
  } catch (e) {
    backupError.value = e instanceof Error ? e.message : '書き出しに失敗しました'
  }
}

async function applyBackupObject(raw: unknown) {
  if (!confirm('いまの端末のデータを、バックアップの内容で置き換えます。よろしいですか？')) return
  await importBackup(raw)
  p.value = {
    ...profile.value,
    skills: [...(profile.value.skills || [])],
    achievements: [...(profile.value.achievements || [])],
    ngConditions: [...(profile.value.ngConditions || [])],
    interestAreas: {
      technologies: [...(profile.value.interestAreas?.technologies || [])],
      companies: [...(profile.value.interestAreas?.companies || [])],
      domains: [...(profile.value.interestAreas?.domains || [])],
    },
  }
  backupMsg.value = '取り込み完了。ホームや案件一覧を確認してください。'
  importText.value = ''
}

async function onPickFile(ev: Event) {
  backupError.value = ''
  backupMsg.value = ''
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const raw = JSON.parse(text)
    await applyBackupObject(raw)
  } catch (e) {
    backupError.value = e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました'
  } finally {
    input.value = ''
  }
}

async function onPasteImport() {
  backupError.value = ''
  backupMsg.value = ''
  try {
    const raw = JSON.parse(importText.value)
    await applyBackupObject(raw)
  } catch (e) {
    backupError.value = e instanceof Error ? e.message : 'JSON の形式が不正です'
  }
}

async function onLogout() {
  resetLocalState()
  await signOut()
  await router.push('/login')
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
      <p class="mb-2 text-[13px] font-bold text-slate-900">関心のある技術・企業・領域</p>
      <p class="mb-2 text-[11px] leading-relaxed text-slate-500">
        応募理由の生成に使います。スキルマッチの加点には使いません（実務経験とは区別されます）。
      </p>
      <label class="cb-label">技術</label>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(t, i) in p.interestAreas?.technologies || []"
          :key="`t-${i}`"
          class="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
        >
          {{ t }}
          <button class="border-none bg-transparent p-0 text-sm text-slate-400" @click="removeInterest('technologies', i)">×</button>
        </span>
      </div>
      <div class="mb-3 flex gap-1.5">
        <input class="cb-input mb-0 flex-1" :value="niTech" placeholder="例: 生成AI" @input="niTech = ($event.target as HTMLInputElement).value" @keydown.enter="addInterest('technologies', niTech); niTech = ''">
        <button class="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-500" @click="addInterest('technologies', niTech); niTech = ''">追加</button>
      </div>
      <label class="cb-label">企業</label>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(t, i) in p.interestAreas?.companies || []"
          :key="`c-${i}`"
          class="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
        >
          {{ t }}
          <button class="border-none bg-transparent p-0 text-sm text-slate-400" @click="removeInterest('companies', i)">×</button>
        </span>
      </div>
      <div class="mb-3 flex gap-1.5">
        <input class="cb-input mb-0 flex-1" :value="niCompany" placeholder="関心のある企業名" @input="niCompany = ($event.target as HTMLInputElement).value" @keydown.enter="addInterest('companies', niCompany); niCompany = ''">
        <button class="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-500" @click="addInterest('companies', niCompany); niCompany = ''">追加</button>
      </div>
      <label class="cb-label">領域</label>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(t, i) in p.interestAreas?.domains || []"
          :key="`d-${i}`"
          class="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
        >
          {{ t }}
          <button class="border-none bg-transparent p-0 text-sm text-slate-400" @click="removeInterest('domains', i)">×</button>
        </span>
      </div>
      <div class="flex gap-1.5">
        <input class="cb-input mb-0 flex-1" :value="niDomain" placeholder="例: 業務改善" @input="niDomain = ($event.target as HTMLInputElement).value" @keydown.enter="addInterest('domains', niDomain); niDomain = ''">
        <button class="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-500" @click="addInterest('domains', niDomain); niDomain = ''">追加</button>
      </div>
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

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">接続状態</p>
      <div class="cb-card mb-0 text-xs text-slate-600">
        <p class="m-0">保存先: {{ remoteEnabled ? 'Supabase（ユーザー分離 + RLS）' : '未接続' }}</p>
        <p v-if="sessionUser" class="m-0 mt-1">ログイン: {{ sessionUser.email }}</p>
        <p v-else class="m-0 mt-1 text-slate-400">未ログイン</p>
        <button class="cb-outline-btn mt-2" type="button" @click="onLogout">ログアウト</button>
      </div>
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">データの持ち運び</p>
      <p class="mb-2 text-[11px] text-slate-500">
        PCで入れたデータをスマホへ移すとき用です。いまの内容: {{ backupSummary }}
      </p>
      <div class="cb-card mb-2">
        <p class="mb-2 text-[11px] font-semibold text-slate-700">1. PCで書き出す</p>
        <button class="cb-cta" type="button" @click="downloadBackup">バックアップをダウンロード</button>
        <p class="mt-2 text-[11px] text-slate-400">
          できた JSON ファイルを LINE / メール / Googleドライブ などでスマホへ送る
        </p>
      </div>
      <div class="cb-card mb-0">
        <p class="mb-2 text-[11px] font-semibold text-slate-700">2. スマホで取り込む</p>
        <input
          ref="fileInput"
          class="mb-2 block w-full text-xs"
          type="file"
          accept="application/json,.json"
          @change="onPickFile"
        >
        <p class="mb-1 text-[11px] text-slate-500">または JSON を貼り付け:</p>
        <textarea
          v-model="importText"
          class="cb-input min-h-[88px] font-mono text-[11px]"
          placeholder='{"version":1,"profile":...}'
        />
        <button class="cb-outline-btn" type="button" :disabled="!importText.trim()" @click="onPasteImport">
          貼り付けた内容を取り込む
        </button>
        <p v-if="backupMsg" class="mt-2 text-xs text-green-700">{{ backupMsg }}</p>
        <p v-if="backupError" class="mt-2 text-xs text-red-600">{{ backupError }}</p>
        <p class="mt-2 text-[11px] text-amber-700">
          取り込むと、この端末のいまのデータはバックアップ内容で置き換わります。
        </p>
      </div>
    </section>

    <section class="mb-4">
      <p class="mb-2 text-[13px] font-bold text-slate-900">今月の AI 利用（Soft Gate）</p>
      <div class="grid grid-cols-2 gap-1.5">
        <div class="cb-card mb-0">
          <p class="m-0 text-[11px] text-slate-500">抽出</p>
          <p class="m-0 text-sm font-semibold text-slate-800">{{ usageCounts.extract }} / {{ AI_USAGE_LIMITS.extract }}</p>
        </div>
        <div class="cb-card mb-0">
          <p class="m-0 text-[11px] text-slate-500">診断</p>
          <p class="m-0 text-sm font-semibold text-slate-800">{{ usageCounts.diagnose }} / {{ AI_USAGE_LIMITS.diagnose }}</p>
        </div>
        <div class="cb-card mb-0">
          <p class="m-0 text-[11px] text-slate-500">提案文</p>
          <p class="m-0 text-sm font-semibold text-slate-800">{{ usageCounts.proposal }} / {{ AI_USAGE_LIMITS.proposal }}</p>
        </div>
        <div class="cb-card mb-0">
          <p class="m-0 text-[11px] text-slate-500">返信支援</p>
          <p class="m-0 text-sm font-semibold text-slate-800">{{ usageCounts.reply }} / {{ AI_USAGE_LIMITS.reply }}</p>
        </div>
      </div>
      <p class="mt-2 text-[11px] text-slate-400">上限到達後も手動入力・既存データでの運用は継続できます。</p>
    </section>

    <button class="cb-cta mt-4" @click="doSave">{{ ok ? '✓ 保存しました' : '保存' }}</button>
  </div>
</template>
