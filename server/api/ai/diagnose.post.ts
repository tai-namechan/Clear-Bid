import { DiagnosisResultSchema, EffortEstimateSchema, ExtractionResultSchema, SafetyFindingSchema } from '../../../shared/schemas/ai'
import type { ApplicationType, EngagementType, Platform, RequirementEvidence, UserProfile } from '../../../shared/types'
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
    budgetMaxYen?: number | null
    feeRatePercent?: number
    deadlineDays?: number | null
    applicants?: number | null
    engagementType?: EngagementType
    budgetType?: string
    expectedMonthlyHoursMin?: string | null
    expectedMonthlyHoursMax?: string | null
    requirementEvidences?: RequirementEvidence[]
    platform?: Platform | string
    applicationType?: ApplicationType
    companyName?: string
    recruiterName?: string
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
    budgetMaxYen: body.budgetMaxYen ?? null,
    feeRatePercent: body.feeRatePercent ?? 20,
    deadlineDays: body.deadlineDays,
    applicants: body.applicants,
    engagementType: body.engagementType,
    budgetType: body.budgetType,
    expectedMonthlyHoursMin: body.expectedMonthlyHoursMin,
    expectedMonthlyHoursMax: body.expectedMonthlyHoursMax,
    requirementEvidences: body.requirementEvidences,
    platform: body.platform,
    applicationType: body.applicationType,
    companyName: body.companyName,
    recruiterName: body.recruiterName,
  })

  const parsed = DiagnosisResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '診断結果の形式が不正です' })
  }
  return parsed.data
})
