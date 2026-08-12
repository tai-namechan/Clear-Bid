import { z } from 'zod'
import { requireUser } from '../utils/auth'
import { putDocument } from '../repositories/documents'
import { createErrorBody } from '../utils/errors'

const BodySchema = z.object({
  key: z.enum(['profile', 'pipeline', 'stats', 'ai_usage']),
  value: z.unknown(),
})

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const config = useRuntimeConfig(event)
  if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
    setResponseStatus(event, 503)
    return createErrorBody({ code: 'SUPABASE_UNAVAILABLE', message: 'Supabase is not configured' })
  }

  const body = BodySchema.safeParse(await readBody(event))
  if (!body.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: 'Invalid sync payload' })
  }

  // Scope is always requireUser().id — never body.userId
  await putDocument(user.id, body.data.key, body.data.value, event.context.accessToken)
  return { ok: true, key: body.data.key }
})
