import { resolveAuthUser } from '../utils/auth'

/**
 * Authenticate every /api request.
 * - Production: Cloudflare Access JWT (Cf-Access-Jwt-Assertion)
 * - Local / unset Access config: AUTH_BYPASS or missing team/aud → dev user
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  // Health/diagnostic endpoint without DB
  if (path === '/api/health') return

  try {
    event.context.user = await resolveAuthUser(event)
  } catch (e) {
    if (isError(e)) throw e
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
