import { resolveAuthUser } from '../utils/auth'

/**
 * Authenticate every /api request except health.
 * User identity always comes from Supabase JWT — never from request body.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (path === '/api/health') return

  try {
    event.context.user = await resolveAuthUser(event)
  } catch (e) {
    if (isError(e)) throw e
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
