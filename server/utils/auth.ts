import type { User } from '@supabase/supabase-js'
import { getUserFromAccessToken, toAuthUser, type AuthUser } from './supabase'

declare module 'h3' {
  interface H3EventContext {
    user?: AuthUser
    accessToken?: string
    supabaseUser?: User
  }
}

function extractBearer(event: H3Event): string | null {
  const header = getHeader(event, 'authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (m?.[1]) return m[1].trim()
  const cookie = getCookie(event, 'sb-access-token')
  return cookie || null
}

/**
 * Resolve the authenticated Supabase user for an API request.
 * Never trusts client-supplied user_id.
 */
export async function resolveAuthUser(event: H3Event): Promise<AuthUser> {
  const config = useRuntimeConfig(event)
  const bypass = config.authBypass === true || config.authBypass === 'true' || config.authBypass === '1'
  const hasSupabase = Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)

  const token = extractBearer(event)
  if (token && hasSupabase) {
    const user = await getUserFromAccessToken(token)
    event.context.accessToken = token
    event.context.supabaseUser = user
    return toAuthUser(user)
  }

  // Local-only bypass when Supabase is not configured (dev without .env).
  if (bypass && !hasSupabase) {
    return {
      id: '00000000-0000-4000-8000-000000000001',
      email: String(config.devUserEmail || 'dev@local.test'),
      displayName: 'Local Dev',
    }
  }

  throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
}

export function requireUser(event: H3Event): AuthUser {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return event.context.user
}
