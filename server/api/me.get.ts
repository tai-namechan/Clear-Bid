import { requireUser } from '../utils/auth'

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const config = useRuntimeConfig(event)
  const configured = Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    persistence: configured ? 'supabase' : 'unconfigured',
    aiProvider: config.aiProvider || 'fallback',
    anthropicConfigured: Boolean(config.anthropicApiKey),
    supabaseConfigured: configured,
  }
})
