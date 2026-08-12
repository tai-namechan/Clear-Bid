<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { signIn, signUp, refresh, user, ready } = useAuth()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  await refresh()
  if (user.value) {
    await router.replace((route.query.redirect as string) || '/')
  }
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'signin') {
      await signIn(email.value.trim(), password.value)
    } else {
      await signUp(email.value.trim(), password.value)
    }
    await router.replace((route.query.redirect as string) || '/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '認証に失敗しました'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="cb-page">
    <h1 class="cb-h1">Clear Bid</h1>
    <p class="mb-4 text-xs text-slate-500">取るべき案件を、クリアに。ログインして続行します。</p>

    <div class="mb-3 flex gap-2">
      <button
        class="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
        :class="mode === 'signin' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'"
        type="button"
        @click="mode = 'signin'"
      >
        ログイン
      </button>
      <button
        class="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
        :class="mode === 'signup' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'"
        type="button"
        @click="mode = 'signup'"
      >
        新規登録
      </button>
    </div>

    <label class="cb-label">メール</label>
    <input v-model="email" class="cb-input" type="email" autocomplete="username" placeholder="you@example.com">

    <label class="cb-label">パスワード</label>
    <input v-model="password" class="cb-input" type="password" autocomplete="current-password" placeholder="8文字以上推奨">

    <p v-if="error" class="mb-2 text-xs text-red-600">{{ error }}</p>
    <p v-if="!ready" class="mb-2 text-xs text-slate-400">認証準備中…</p>

    <button class="cb-cta" type="button" :disabled="busy || !email || !password" @click="submit">
      {{ busy ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する' }}
    </button>

    <p class="mt-3 text-[11px] leading-relaxed text-slate-400">
      データはユーザーごとに分離されます。他人の案件・金額・提案文は見えません。
    </p>
  </div>
</template>
