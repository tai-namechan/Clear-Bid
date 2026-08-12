import { DiagnosisResultSchema, ExtractionResultSchema, ProposalResultSchema, PROPOSAL_STRATEGIES } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const payload = await readBody<{
    title?: string
    diagnosis?: unknown
    extraction?: unknown
    profile?: UserProfile
    forceStrategy?: string
    platform?: string
    jobUrl?: string
    requirementEvidences?: import('../../../shared/types').RequirementEvidence[]
    consultantQuestions?: string[]
    jobBody?: string
    companyName?: string
    recruiterName?: string
    messageLength?: 'short' | 'long'
  }>(event)

  if (!payload?.title || !payload?.profile) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案生成に必要な入力が不足しています' })
  }

  const diagnosis = DiagnosisResultSchema.safeParse(payload.diagnosis)
  const extraction = ExtractionResultSchema.safeParse(payload.extraction)
  if (!diagnosis.success || !extraction.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案入力の形式が不正です' })
  }

  if (payload.forceStrategy && !(PROPOSAL_STRATEGIES as readonly string[]).includes(payload.forceStrategy)) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '不正な提案型です' })
  }

  const provider = getAiProvider()
  const request = {
    title: payload.title,
    diagnosis: diagnosis.data,
    extraction: extraction.data,
    profile: payload.profile,
    forceStrategy: payload.forceStrategy,
    platform: payload.platform,
    jobUrl: payload.jobUrl,
    requirementEvidences: payload.requirementEvidences,
    consultantQuestions: payload.consultantQuestions,
    body: payload.jobBody,
    companyName: payload.companyName,
    recruiterName: payload.recruiterName,
    messageLength: payload.messageLength,
  }
  let result = await provider.generateProposal(request)

  if (payload.platform === 'youtrust' && (result.body?.length || 0) > 200) {
    const fb = getAiProvider({ aiProvider: 'fallback', anthropicApiKey: '' })
    result = await fb.generateProposal(request)
  }

  const parsed = ProposalResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '提案文の形式が不正です' })
  }
  if (payload.platform === 'youtrust' && parsed.data.body.length > 200) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: 'YouTrustメッセージが200字を超えています' })
  }
  return parsed.data
})
