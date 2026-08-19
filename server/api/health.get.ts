export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const hasDb = Boolean(event.context.cloudflare?.env?.DB)
  return {
    ok: true,
    app: 'clear-bid',
    persistence: hasDb ? 'd1' : 'local',
    aiProvider: config.aiProvider || 'fallback',
    anthropicConfigured: Boolean(config.anthropicApiKey),
    accessConfigured: Boolean(config.cfAccessTeamDomain && config.cfAccessAud),
  }
})
