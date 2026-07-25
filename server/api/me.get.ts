import { requireUser } from '../utils/auth'
import { hasDb } from '../utils/db'

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const config = useRuntimeConfig(event)
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    persistence: hasDb(event) ? 'd1' : 'local',
    aiProvider: config.aiProvider || 'fallback',
    anthropicConfigured: Boolean(config.anthropicApiKey),
    accessConfigured: Boolean(config.cfAccessTeamDomain && config.cfAccessAud),
  }
})
