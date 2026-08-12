import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function useSupabaseBrowser(): SupabaseClient {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const anon = String(config.public.supabaseAnonKey || '')
  if (!url || !anon) {
    throw new Error('Supabase public config missing')
  }
  if (!browserClient) {
    browserClient = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}

export function useAuth() {
  const session = useState<Session | null>('cb-session', () => null)
  const user = useState<User | null>('cb-auth-user', () => null)
  const ready = useState<boolean>('cb-auth-ready', () => false)

  const refresh = async () => {
    if (!import.meta.client) return
    const config = useRuntimeConfig()
    if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
      session.value = null
      user.value = null
      ready.value = true
      return
    }
    const sb = useSupabaseBrowser()
    const { data } = await sb.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    ready.value = true
  }

  const getAccessToken = async () => {
    if (!import.meta.client) return null
    const config = useRuntimeConfig()
    if (!config.public.supabaseUrl) return null
    const sb = useSupabaseBrowser()
    const { data } = await sb.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    return data.session?.access_token ?? null
  }

  const signIn = async (email: string, password: string) => {
    const sb = useSupabaseBrowser()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    user.value = data.user
    return data
  }

  const signUp = async (email: string, password: string) => {
    const sb = useSupabaseBrowser()
    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) throw error
    session.value = data.session
    user.value = data.user
    return data
  }

  const signOut = async () => {
    const sb = useSupabaseBrowser()
    await sb.auth.signOut()
    session.value = null
    user.value = null
  }

  return {
    session,
    user,
    ready,
    refresh,
    getAccessToken,
    signIn,
    signUp,
    signOut,
  }
}

/** Authenticated $fetch — attaches Supabase JWT. Never send user_id in body for auth. */
export async function apiFetch<T>(url: string, opts: Parameters<typeof $fetch<T>>[1] = {}): Promise<T> {
  const { getAccessToken } = useAuth()
  const token = await getAccessToken()
  const headers = {
    ...(opts?.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return $fetch<T>(url, { ...opts, headers })
}
