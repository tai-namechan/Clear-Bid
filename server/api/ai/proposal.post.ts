import { DiagnosisResultSchema, ExtractionResultSchema, ProposalResultSchema, PROPOSAL_STRATEGIES } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    diagnosis?: unknown
    extraction?: unknown
    profile?: UserProfile
    forceStrategy?: string
  }>(event)

  if (!body?.title || !body?.profile) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案生成に必要な入力が不足しています' })
  }

  const diagnosis = DiagnosisResultSchema.safeParse(body.diagnosis)
  const extraction = ExtractionResultSchema.safeParse(body.extraction)
  if (!diagnosis.success || !extraction.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案入力の形式が不正です' })
  }

  if (body.forceStrategy && !(PROPOSAL_STRATEGIES as readonly string[]).includes(body.forceStrategy)) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '不正な提案型です' })
  }

  const provider = getAiProvider()
  const result = await provider.generateProposal({
    title: body.title,
    diagnosis: diagnosis.data,
    extraction: extraction.data,
    profile: body.profile,
    forceStrategy: body.forceStrategy,
  })
  const parsed = ProposalResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '提案文の形式が不正です' })
  }
  return parsed.data
})
