import type { DiagnosisResult, ExtractionResult, ProposalResult } from '../../shared/schemas/ai'
import {
  recommendYoutrustInterestTarget,
  YOUTRUST_INTEREST_LABELS,
} from '../../shared/domain/applicationJudgment'
import type { UserProfile, YoutrustInterestTarget } from '../../shared/types'

export interface PlatformMessageInput {
  title: string
  body?: string
  diagnosis: DiagnosisResult
  extraction: ExtractionResult
  profile: UserProfile
  companyName?: string
  recruiterName?: string
  forceLength?: 'short' | 'long'
}

const GENERIC_PHRASES = ['強く惹かれました', '魅力を感じました', '貢献したいです']

function pickJobSpecificTerm(title: string, body: string, extraction: ExtractionResult): string {
  const candidates = [
    extraction.role?.text,
    ...(extraction.deliverables || []).map((d) => d.text),
    ...(extraction.requiredSkills || []).map((s) => s.text),
    ...(extraction.requiredRequirements || []).map((r) => r.text),
  ].filter((x): x is string => Boolean(x && x.trim()))

  for (const c of candidates) {
    const short = c.replace(/[。．].*$/, '').slice(0, 24)
    if (short.length >= 2) return short
  }

  const fromBody =
    body.match(
      /倉庫オペレーション|音声認識|信号処理|業務改善|要件整理|社内業務|AI化|SFA|Webサービス|業務システム|シナリオ|条件分岐|配信運用|API連携|自社プロダクト|自動化/,
    )?.[0] || title.slice(0, 20)
  return fromBody || '募集内容'
}

function profileEvidence(profile: UserProfile, diagnosis: DiagnosisResult): string[] {
  const fromDiag = (diagnosis.matchedExperiences || []).map((m) => m.evidenceSource)
  if (fromDiag.length) return fromDiag.slice(0, 3)
  const skills = (profile.skills || [])
    .filter((s) => s.level === '実務')
    .slice(0, 2)
    .map((s) => `スキル: ${s.name}`)
  const ach = (profile.achievements || []).slice(0, 1).map((a) => `実績: ${a.title}`)
  return [...skills, ...ach].slice(0, 3)
}

function missingDisclaimer(diagnosis: DiagnosisResult): string {
  const missing = (diagnosis.requirements || []).find(
    (r) => r.importance === 'required' && (r.status === 'missing' || r.status === 'transferable'),
  )
  if (!missing) return ''
  if (missing.status === 'transferable') {
    return `類似する業務改善の経験として触れつつ、${missing.requirement}の実務経験はない点は明示します。`
  }
  return `${missing.requirement}の実務経験はありませんが、関連する業務経験を踏まえて伺いたいです。`
}

function stripGenericOnly(text: string, jobTerm: string): string {
  let out = text
  for (const p of GENERIC_PHRASES) {
    if (out.includes(p) && !out.includes(jobTerm)) {
      out = out.replace(p, `${jobTerm}に関心があります`)
    }
  }
  if (!out.includes(jobTerm)) {
    out = `${jobTerm}について拝見しました。${out}`
  }
  return out
}

function clampYoutrust(body: string, max = 200): string {
  if (body.length <= max) return body
  return `${body.slice(0, max - 1)}…`
}

export function buildYoutrustMessage(input: PlatformMessageInput): ProposalResult {
  const name = input.profile.name || '応募者'
  const jobTerm = pickJobSpecificTerm(input.title, input.body || '', input.extraction)
  const evidence = profileEvidence(input.profile, input.diagnosis)
  const interest = recommendYoutrustInterestTarget(
    input.body || '',
    input.companyName,
    input.recruiterName,
  ) as YoutrustInterestTarget
  const contact = evidence[0] || '登録プロフィールの業務経験'
  const miss = missingDisclaimer(input.diagnosis)
  const next =
    (input.diagnosis.questionsToConfirm || [])[0] ||
    (input.diagnosis.preQuestions || [])[0] ||
    '稼働条件と担当範囲'

  let body = [
    `${name}です。`,
    `${jobTerm}の募集を拝見し、${contact.replace(/^スキル: |^実績: /, '')}の観点から接点があると感じました。`,
    miss || `特に${jobTerm}まわりで、進め方や期待役割を伺えればと思います。`,
    `次は${next}についてお話しできれば幸いです。`,
  ]
    .filter(Boolean)
    .join('')

  body = stripGenericOnly(body, jobTerm)
  body = clampYoutrust(body, 200)

  return {
    strategy: 'YouTrust一言',
    strategyReason: `興味対象「${YOUTRUST_INTEREST_LABELS[interest]}」向けに1案生成`,
    body,
    usedAchievements: evidence,
    preQuestions: (input.diagnosis.questionsToConfirm || input.diagnosis.preQuestions || []).slice(0, 3),
    assumptions: ['プロフィールにない経験は追加していない', '200字以内'],
    scopeIn: [jobTerm],
    scopeOut: (input.diagnosis.gaps || []).slice(0, 3),
    meetingTopics: (input.diagnosis.questionsToConfirm || []).slice(0, 3),
    documentType: 'youtrust_message',
    recommendedInterestTarget: interest,
    messageCharacterCount: body.length,
    evidenceUsed: evidence,
  }
}

export function buildShortApplicationMessage(input: PlatformMessageInput): ProposalResult {
  const jobTerm = pickJobSpecificTerm(input.title, input.body || '', input.extraction)
  const evidence = profileEvidence(input.profile, input.diagnosis)
  const miss = missingDisclaimer(input.diagnosis)
  const name = input.profile.name || '応募者'
  let body = [
    `${name}です。`,
    `${jobTerm}について、${evidence[0]?.replace(/^スキル: |^実績: /, '') || '関連経験'}を活かせると考えご連絡しました。`,
    miss,
    `稼働は${input.profile.availableTimes || '要相談'}です。詳細を伺えれば幸いです。`,
  ]
    .filter(Boolean)
    .join('')
  body = stripGenericOnly(body, jobTerm)
  body = clampYoutrust(body, 280)

  return {
    strategy: '短文応募',
    strategyReason: 'その他媒体向けの短文メッセージ',
    body,
    usedAchievements: evidence,
    preQuestions: (input.diagnosis.questionsToConfirm || []).slice(0, 3),
    assumptions: ['不足経験は明示または未記載'],
    scopeIn: [jobTerm],
    scopeOut: [],
    meetingTopics: [],
    documentType: 'short_message',
    messageCharacterCount: body.length,
    evidenceUsed: evidence,
  }
}

export function enforceProposalQuality(
  result: ProposalResult,
  input: PlatformMessageInput,
): ProposalResult {
  const jobTerm = pickJobSpecificTerm(input.title, input.body || '', input.extraction)
  let body = result.body || ''
  body = stripGenericOnly(body, jobTerm)

  if (result.documentType === 'youtrust_message') {
    body = clampYoutrust(body, 200)
  }

  // プロフィールにないスキル名の単純な「経験があります」を落とす
  const known = new Set(
    [
      ...(input.profile.skills || []).map((s) => s.name),
      ...(input.profile.achievements || []).flatMap((a) => [a.title, ...(a.tech || [])]),
    ]
      .filter(Boolean)
      .map((s) => s.toLowerCase()),
  )
  for (const req of input.diagnosis.requirements || []) {
    if (req.status === 'missing' || req.status === 'unverified') {
      const claim = new RegExp(`${req.requirement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}の(実務)?経験があります`, 'g')
      if (claim.test(body) && ![...known].some((k) => req.requirement.toLowerCase().includes(k))) {
        body = body.replace(claim, `${req.requirement}の実務経験はありませんが`)
      }
    }
  }

  return {
    ...result,
    body,
    messageCharacterCount: body.length,
    evidenceUsed: result.evidenceUsed?.length ? result.evidenceUsed : profileEvidence(input.profile, input.diagnosis),
  }
}
