import { DiagnosisResultSchema, EffortEstimateSchema, ExtractionResultSchema, SafetyFindingSchema } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    body?: string
    extraction?: unknown
    safety?: unknown
    effort?: unknown
    profile?: UserProfile
    budgetMinYen?: number | null
    feeRatePercent?: number
    deadlineDays?: number | null
    applicants?: number | null
  }>(event)

  if (!body?.title || !body?.body || !body?.profile) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '診断に必要な入力が不足しています' })
  }

  const extraction = ExtractionResultSchema.safeParse(body.extraction)
  const safety = SafetyFindingSchema.array().safeParse(body.safety || [])
  const effort = EffortEstimateSchema.safeParse(body.effort)
  if (!extraction.success || !safety.success || !effort.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '診断入力の形式が不正です' })
  }

  const provider = getAiProvider()
  const result = await provider.diagnose({
    title: body.title,
    body: body.body,
    extraction: extraction.data,
    safety: safety.data,
    effort: effort.data,
    profile: body.profile,
    budgetMinYen: body.budgetMinYen ?? null,
    feeRatePercent: body.feeRatePercent ?? 20,
    deadlineDays: body.deadlineDays,
    applicants: body.applicants,
  })

  const parsed = DiagnosisResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '診断結果の形式が不正です' })
  }
  return parsed.data
})
