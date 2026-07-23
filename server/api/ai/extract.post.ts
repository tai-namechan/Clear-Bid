import { ExtractionResultSchema } from '../../../shared/schemas/ai'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ title?: string; body?: string }>(event)
  if (!body?.title?.trim() || !body?.body?.trim()) {
    setResponseStatus(event, 400)
    return createErrorBody({
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください',
      fields: {
        title: body?.title?.trim() ? [] : ['案件タイトルは必須です'],
        body: body?.body?.trim() ? [] : ['募集文は必須です'],
      },
    })
  }

  const provider = getAiProvider()
  const result = await provider.extract({ title: body.title, body: body.body })
  const parsed = ExtractionResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({
      code: 'AI_SCHEMA_ERROR',
      message: '抽出結果の形式が不正です',
    })
  }
  return parsed.data
})
