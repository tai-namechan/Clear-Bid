import { z } from 'zod'
import { requireUser } from '../utils/auth'
import { hasDb, useDb } from '../utils/db'
import { putDocument, type DocumentKey } from '../repositories/documents'
import { createErrorBody } from '../utils/errors'

const BodySchema = z.object({
  key: z.enum(['profile', 'pipeline', 'stats', 'ai_usage']),
  value: z.unknown(),
})

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  if (!hasDb(event)) {
    setResponseStatus(event, 503)
    return createErrorBody({ code: 'D1_UNAVAILABLE', message: 'D1 is not bound; using localStorage' })
  }
  const body = BodySchema.safeParse(await readBody(event))
  if (!body.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: 'Invalid sync payload' })
  }
  const db = useDb(event)
  await putDocument(db, user.id, body.data.key as DocumentKey, body.data.value)
  return { ok: true, key: body.data.key }
})
