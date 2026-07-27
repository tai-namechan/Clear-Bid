import type { DiagnosisResult, ExtractionResult, ProposalResult } from '../../shared/schemas/ai'
import type { RequirementEvidence, UserProfile } from '../../shared/types'
import { supportedEvidencesOnly } from '../../shared/domain/flexy'

export interface FlexyMessageInput {
  title: string
  diagnosis: DiagnosisResult
  extraction: ExtractionResult
  profile: UserProfile
  jobUrl?: string
  requirementEvidences?: RequirementEvidence[]
  consultantQuestions?: string[]
}

export function buildFlexyInterestMessage(input: FlexyMessageInput): ProposalResult {
  const name = input.profile.name || '応募者'
  const supported = supportedEvidencesOnly(input.requirementEvidences || [])
  const role = input.extraction.role?.text || input.title
  const questions = [
    ...(input.consultantQuestions || []),
    ...(input.diagnosis.preQuestions || []),
  ].filter(Boolean)
  const uniqueQ = [...new Set(questions)].slice(0, 3)

  const evidenceLines = supported
    .slice(0, 4)
    .map((e) => `・${e.requirement}：${e.evidenceNote}`)
    .join('\n')

  const parts = [
    `FLEXYご担当者様`,
    ``,
    `はじめまして。${name}と申します。`,
    `「${role}」の案件について、応募を希望いたします。`,
    input.jobUrl?.trim() ? `案件URL: ${input.jobUrl.trim()}` : '',
    ``,
    `応募理由としては、必須要件のうち確認済みの経験を活かし、継続的に貢献できると考えたためです。`,
    evidenceLines ? `確認済みの根拠:\n${evidenceLines}` : '',
    ``,
    `稼働可能時間は ${input.profile.availableTimes || '要相談'}（週あたり約${input.profile.weeklyHours}時間）です。`,
    uniqueQ.length
      ? `ご確認したい点:\n${uniqueQ.map((q) => `・${q}`).join('\n')}`
      : '月間の想定稼働時間や日中MTGの要否など、詳細条件を伺えれば幸いです。',
    ``,
    `ご検討のほど、よろしくお願いいたします。`,
  ]

  let body = parts.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (body.length < 250) {
    body += `\n\n進め方としては、要件のすり合わせから着手し、優先度の高い課題から段階的に対応したいと考えています。`
  }

  for (const e of input.requirementEvidences || []) {
    if (e.status !== 'supported' && e.requirement) {
      const claim = `${e.requirement}の経験があります`
      if (body.includes(claim)) {
        body = body.replaceAll(claim, '')
      }
    }
  }

  return {
    strategy: 'FLEXY応募希望',
    strategyReason: 'FLEXYは担当者経由の応募のため、応募希望メッセージを1案生成しました',
    body: body.trim(),
    usedAchievements: supported.map((e) => e.requirement),
    preQuestions: uniqueQ,
    assumptions: ['未確認の必須要件は記載していない', '月間時間は担当者確認事項'],
    scopeIn: supported.map((e) => e.requirement),
    scopeOut: (input.requirementEvidences || [])
      .filter((e) => e.status === 'unsupported' || e.status === 'unverified')
      .map((e) => e.requirement),
    meetingTopics: uniqueQ,
    documentType: 'interest_message',
  }
}
