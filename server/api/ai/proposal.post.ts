import { DiagnosisResultSchema, ExtractionResultSchema, ProposalResultSchema } from '../../../shared/schemas/ai'
import type { UserProfile } from '../../../shared/types'
import { getAiProvider } from '../../ai/provider'
import { createErrorBody } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: string
    diagnosis?: unknown
    extraction?: unknown
    profile?: UserProfile
  }>(event)

  if (!body?.title || !body?.profile) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案生成に必要な入力が不足しています' })
  }

  const openBlocks = Array.isArray((body.diagnosis as { axes?: unknown })?.axes) // placeholder for type narrowing
  void openBlocks

  const diagnosis = DiagnosisResultSchema.safeParse(body.diagnosis)
  const extraction = ExtractionResultSchema.safeParse(body.extraction)
  if (!diagnosis.success || !extraction.success) {
    setResponseStatus(event, 400)
    return createErrorBody({ code: 'VALIDATION_ERROR', message: '提案入力の形式が不正です' })
  }

  if (diagnosis.data.recommendation === 'skip') {
    // Spec: BLOCK / skip candidates pause proposal generation; still allow user override via explicit call.
  }

  const provider = getAiProvider()
  const result = await provider.generateProposal({
    title: body.title,
    diagnosis: diagnosis.data,
    extraction: extraction.data,
    profile: body.profile,
  })
  const parsed = ProposalResultSchema.safeParse(result)
  if (!parsed.success) {
    setResponseStatus(event, 502)
    return createErrorBody({ code: 'AI_SCHEMA_ERROR', message: '提案文の形式が不正です' })
  }
  return parsed.data
})
