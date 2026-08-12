export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  if (to.path === '/login') return

  const config = useRuntimeConfig()
  if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
    // Misconfigured: send to login with message context
    return navigateTo('/login')
  }

  const { refresh, user, ready } = useAuth()
  if (!ready.value) await refresh()
  if (!user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
