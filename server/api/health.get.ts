export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  return {
    ok: true,
    app: 'clear-bid',
    persistence: config.public.supabaseUrl ? 'supabase' : 'unconfigured',
    aiProvider: config.aiProvider || 'fallback',
    anthropicConfigured: Boolean(config.anthropicApiKey),
    supabaseConfigured: Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey),
  }
})
