import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type DocumentKey = 'profile' | 'pipeline' | 'stats' | 'ai_usage'

export interface AuthUser {
  id: string
  email: string
  displayName?: string | null
}

function requireConfig() {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const anonKey = String(config.public.supabaseAnonKey || '')
  const serviceKey = String(config.supabaseServiceRoleKey || '')
  if (!url || !anonKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Supabase is not configured (NUXT_PUBLIC_SUPABASE_URL / ANON_KEY)',
    })
  }
  return { url, anonKey, serviceKey, allowedEmail: String(config.allowedEmail || '').trim().toLowerCase() }
}

/** Service-role client: server only. Always filter by verified user_id — never trust body user_id. */
export function useServiceSupabase(): SupabaseClient {
  const { url, serviceKey, anonKey } = requireConfig()
  const key = serviceKey || anonKey
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** User-scoped client: JWT attached so RLS auth.uid() works. */
export function useUserSupabase(accessToken: string): SupabaseClient {
  const { url, anonKey } = requireConfig()
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getUserFromAccessToken(accessToken: string): Promise<User> {
  const { url, anonKey, allowedEmail } = requireConfig()
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }
  const email = (data.user.email || '').toLowerCase()
  if (allowedEmail && email !== allowedEmail) {
    throw createError({ statusCode: 403, statusMessage: 'This account is not allowed' })
  }
  return data.user
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    displayName: (user.user_metadata?.full_name as string | undefined) || user.email || null,
  }
}
