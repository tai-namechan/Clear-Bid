import { ReplyAssistSchema } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    replyBody?: string
    profile?: UserProfile
  }>(event)

  if (!body?.title?.trim() || !body?.replyBody?.trim()) {
    setResponseStatus(event, 400)
    return createErrorBody({
      code: 'VALIDATION_ERROR',
      message: '案件タイトルと返信文は必須です',
    })
  }

  const provider = getAiProvider()
  const result = await provider.assistReply({
    title: body.title,
    replyBody: body.replyBody,
    profile: body.profile || ({ name: '', skills: [], achievements: [] } as UserProfile),
  })
  const parsed = ReplyAssistSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '返信支援結果の形式が不正です' })
  }
  return parsed.data
})
