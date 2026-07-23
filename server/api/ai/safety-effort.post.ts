import { EffortEstimateSchema, SafetyFindingSchema } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { runSafetyRules } from '../../rules/engine'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    body?: string
    budgetMin?: string
    client?: {
      rating?: string
      reviews?: string
      orders?: string
      completionRate?: string
      verified?: boolean
      certified?: boolean
    }
    profile?: UserProfile
  }>(event)

  if (!body?.title?.trim() || !body?.body?.trim()) {
    setResponseStatus(event, 400)
    return createErrorBody({
      code: 'VALIDATION_ERROR',
      message: '案件タイトルと募集文は必須です',
    })
  }

  const safetyRaw = runSafetyRules({
    title: body.title,
    body: body.body,
    budgetMin: body.budgetMin,
    clientRating: body.client?.rating,
    clientOrders: body.client?.orders,
  })
  const safety = safetyRaw
    .map((s) => SafetyFindingSchema.safeParse(s))
    .filter((r) => r.success)
    .map((r) => r.data)

  const provider = getAiProvider()
  const effort = await provider.estimate({
    title: body.title,
    body: body.body,
    client: body.client || {},
    profile: body.profile || ({ skills: [], weeklyHours: 10, minHourlyYen: 2000, ngConditions: [], achievements: [] } as UserProfile),
    safety,
  })
  const parsed = EffortEstimateSchema.safeParse(effort)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '工数見積りの形式が不正です' })
  }

  return { safety, effort: parsed.data }
})
