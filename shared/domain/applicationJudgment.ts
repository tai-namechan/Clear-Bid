import type { ExtractionResult } from '../schemas/ai'
import type {
  ApplicationPriority,
  ApplicationType,
  ConditionRisk,
  InterestAreas,
  JudgmentLabel,
  MatchedExperience,
  Platform,
  ProfileAchievement,
  ProfileSkill,
  RecommendedAction,
  RequirementAssessment,
  RequirementEvidence,
  RequirementMatchStatus,
  UserProfile,
} from '../types'

export function emptyInterestAreas(): InterestAreas {
  return { technologies: [], companies: [], domains: [] }
}

export function normalizeInterestAreas(raw: unknown): InterestAreas {
  const empty = emptyInterestAreas()
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const asList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []
  return {
    technologies: asList(o.technologies),
    companies: asList(o.companies),
    domains: asList(o.domains),
  }
}

/** 募集文・URLから媒体を推定。不明時は null（ユーザー選択を優先）。 */
export function inferPlatformFromText(title: string, body: string, url = ''): Platform | null {
  const src = `${title}\n${body}\n${url}`.toLowerCase()
  if (/youtrust|ユートラスト/.test(src)) return 'youtrust'
  if (/flexy|フレキシ/.test(src)) return 'flexy'
  if (/crowdworks|クラウドワークス|crowd.?works/.test(src)) return 'crowdworks'
  if (/coconala|ココナラ/.test(src)) return 'coconala'
  if (/lancers|ランサーズ/.test(src)) return 'lancers'
  return null
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function practicalSkills(profile: UserProfile): ProfileSkill[] {
  return (profile.skills || []).filter((s) => s.level === '実務')
}

function personalSkills(profile: UserProfile): ProfileSkill[] {
  return (profile.skills || []).filter((s) => s.level === '個人開発')
}

function learningSkills(profile: UserProfile): ProfileSkill[] {
  return (profile.skills || []).filter((s) => s.level === '学習中')
}

function interestTexts(profile: UserProfile): string[] {
  const areas = profile.interestAreas || emptyInterestAreas()
  return [
    ...areas.technologies,
    ...areas.companies,
    ...areas.domains,
    ...learningSkills(profile).map((s) => s.name),
  ].map(normalizeKey)
}

function skillMatchesRequirement(skillName: string, requirement: string): boolean {
  const sk = normalizeKey(skillName)
  const req = normalizeKey(requirement)
  if (!sk || !req) return false
  return req.includes(sk) || sk.includes(req) || req.split(/[・、,/／\s]+/).some((p) => p.length >= 2 && (sk.includes(p) || p.includes(sk)))
}

function achievementMatches(ach: ProfileAchievement, requirement: string): boolean {
  const blob = normalizeKey([ach.title, ach.problem, ach.action, ach.result, ...(ach.tech || [])].filter(Boolean).join(' '))
  const req = normalizeKey(requirement)
  if (!blob || !req) return false
  if (blob.includes(req) || req.includes(blob.slice(0, Math.min(20, blob.length)))) return true
  return (ach.tech || []).some((t) => skillMatchesRequirement(t, requirement))
}

/**
 * プロフィール事実のみで要件を分類。関心・学習中だけでは matched にしない。
 */
export function classifyRequirementAgainstProfile(
  requirement: string,
  importance: 'required' | 'preferred',
  profile: UserProfile,
): RequirementAssessment {
  const practical = practicalSkills(profile).find((s) => skillMatchesRequirement(s.name, requirement))
  if (practical) {
    return {
      requirement,
      importance,
      status: 'matched',
      reason: `登録スキル「${practical.name}」（実務${practical.years != null ? ` ${practical.years}年` : ''}）と一致`,
      howToHandle: '応募文で実務経験として具体的に触れてよい',
    }
  }

  const ach = (profile.achievements || []).find((a) => achievementMatches(a, requirement))
  if (ach) {
    return {
      requirement,
      importance,
      status: 'matched',
      reason: `実績「${ach.title}」に関連記載あり`,
      howToHandle: '実績の事実範囲で接点を説明する',
    }
  }

  const personal = personalSkills(profile).find((s) => skillMatchesRequirement(s.name, requirement))
  if (personal) {
    return {
      requirement,
      importance,
      status: 'transferable',
      reason: `「${personal.name}」は個人開発レベル。実務経験としては未確認`,
      howToHandle: '個人開発である旨を明示し、実務経験があるとは書かない',
    }
  }

  // 類似: 業務改善・要件整理・Web開発など汎用キーワードがプロフィールにある場合
  const transferableHints = ['要件整理', '業務改善', '業務フロー', 'web', 'api', 'typescript', '改善']
  const profileBlob = normalizeKey(
    [
      ...(profile.skills || []).map((s) => s.name),
      ...(profile.achievements || []).flatMap((a) => [a.title, a.action, a.result]),
      profile.bio || '',
    ]
      .filter(Boolean)
      .join(' '),
  )
  const reqNorm = normalizeKey(requirement)
  const hasTransferable =
    transferableHints.some((h) => reqNorm.includes(h) && profileBlob.includes(h)) ||
    (/改善|要件|ヒアリング|業務/.test(reqNorm) && /改善|要件|ヒアリング|業務/.test(profileBlob))

  if (hasTransferable && !interestOnlyHit(requirement, profile)) {
    return {
      requirement,
      importance,
      status: 'transferable',
      reason: '直接一致はないが、類似の業務改善・要件整理・Web経験を転用できる可能性',
      howToHandle: '類似経験として伝え、必須専門スキルの不足は隠さない',
    }
  }

  if (interestOnlyHit(requirement, profile)) {
    return {
      requirement,
      importance,
      status: 'missing',
      reason: '関心・学習中の記載はあるが、実務経験としては確認できない',
      howToHandle: '興味があることと実務経験を分けて書く。経験があるとは書かない',
    }
  }

  // プロフィールに手掛かりがない必須は missing、歓迎は unverified 寄り
  if (importance === 'preferred') {
    return {
      requirement,
      importance,
      status: 'unverified',
      reason: 'プロフィールだけでは判断できない',
      howToHandle: '応募文では触れないか、未経験であることを確認してから書く',
    }
  }

  return {
    requirement,
    importance,
    status: 'missing',
    reason: 'プロフィール・実績に該当経験の記載がない',
    howToHandle: importance === 'required'
      ? '不足を隠さず、類似経験があれば転用として明示する'
      : '無理に言及しない',
  }
}

function interestOnlyHit(requirement: string, profile: UserProfile): boolean {
  const interests = interestTexts(profile)
  const learning = learningSkills(profile)
  return (
    interests.some((i) => skillMatchesRequirement(i, requirement)) ||
    learning.some((s) => skillMatchesRequirement(s.name, requirement))
  )
}

export function buildRequirementAssessments(
  extraction: ExtractionResult | null,
  profile: UserProfile,
  evidences?: RequirementEvidence[],
): RequirementAssessment[] {
  const required = extraction?.requiredRequirements?.length
    ? extraction.requiredRequirements
    : extraction?.requiredSkills || []
  const preferred = extraction?.preferredRequirements || []

  const fromExtraction: RequirementAssessment[] = [
    ...required.map((r) => classifyRequirementAgainstProfile(r.text, 'required', profile)),
    ...preferred.map((r) => classifyRequirementAgainstProfile(r.text, 'preferred', profile)),
  ]

  // FLEXY 本人確認エビデンスがある場合は上書き（決定的な本人入力を優先）
  if (evidences?.length) {
    const byReq = new Map(fromExtraction.map((a) => [normalizeKey(a.requirement), a]))
    for (const e of evidences) {
      const key = normalizeKey(e.requirement)
      const base = byReq.get(key) || classifyRequirementAgainstProfile(e.requirement, 'required', profile)
      const status: RequirementMatchStatus =
        e.status === 'supported'
          ? 'matched'
          : e.status === 'partial'
            ? 'transferable'
            : e.status === 'unsupported'
              ? 'missing'
              : 'unverified'
      byReq.set(key, {
        ...base,
        requirement: e.requirement,
        status,
        reason: e.evidenceNote || base.reason,
        howToHandle:
          status === 'matched'
            ? '確認済み根拠のみ応募文に使う'
            : status === 'missing'
              ? '経験なしとして扱い、捏造しない'
              : '本人確認が終わるまで実務経験とは書かない',
      })
    }
    return [...byReq.values()]
  }

  return fromExtraction
}

export function detectConditionRisks(
  body: string,
  title: string,
  profile: UserProfile,
  extraction: ExtractionResult | null,
): ConditionRisk[] {
  const text = `${title}\n${body}\n${extraction?.recruitmentBackground?.text || ''}\n${extraction?.requiredAvailability?.text || ''}`
  const risks: ConditionRisk[] = []

  if (/正社員|社員登用|転職前提|採用目的|見極め|本採用/.test(text) && /副業|業務委託|複業/.test(text)) {
    risks.push({
      risk: '副業募集に見えるが、正社員採用前提のお試し参画の可能性がある',
      evidence: (text.match(/正社員[^。\n]{0,40}|社員登用[^。\n]{0,40}|採用目的[^。\n]{0,40}/) || ['正社員・採用関連の記載'])[0],
    })
  } else if (/正社員転換|社員化|フルタイム化/.test(text)) {
    risks.push({
      risk: '将来的な正社員転換が必須または強く期待されている',
      evidence: (text.match(/正社員転換[^。\n]{0,40}|社員化[^。\n]{0,40}/) || ['正社員転換関連の記載'])[0],
    })
  }

  if (/平日日中|ビジネスタイム|日中のMTG|日中MTG|コアタイム/.test(text)) {
    risks.push({
      risk: '平日日中のMTG・稼働が求められる可能性',
      evidence: (text.match(/平日日中[^。\n]{0,30}|ビジネスタイム[^。\n]{0,30}|日中[^。\n]{0,20}MTG[^。\n]{0,20}/) || ['日中稼働の記載'])[0],
    })
  }

  if (/常時対応|緊急対応|即レス|すぐに返信|オンコール/.test(text)) {
    risks.push({
      risk: '常時対応や緊急対応が必要',
      evidence: (text.match(/常時対応[^。\n]{0,20}|緊急対応[^。\n]{0,20}|即レス[^。\n]{0,20}/) || ['常時・緊急対応の記載'])[0],
    })
  }

  if (/必須/.test(text) && /経験/.test(text) && /専門|研究開発|アルゴリズム|音声|信号処理/.test(text)) {
    risks.push({
      risk: '専門経験が事実上必須',
      evidence: '専門領域の必須経験に関する記載',
    })
  }

  if (!/円|万円|報酬|単価|月額|予算/.test(text) && extraction?.budget?.provenance === 'unknown') {
    risks.push({
      risk: '報酬が不明',
      evidence: '募集文に明確な報酬記載がない',
    })
  }

  if (/何でも|幅広く|フルスタックに近い|責任者|オーナーシップを強く/.test(text)) {
    risks.push({
      risk: '業務範囲が広い、または副業では負担が大きい責任範囲の可能性',
      evidence: (text.match(/責任者[^。\n]{0,20}|幅広く[^。\n]{0,20}|オーナーシップ[^。\n]{0,20}/) || ['広い範囲・責任の記載'])[0],
    })
  }

  const hoursMatch = text.match(/月\s*([0-9０-９]+)\s*[〜~\-－–]\s*([0-9０-９]+)\s*時間/)
  if (hoursMatch) {
    const maxH = Number(hoursMatch[2].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
    const avail = Math.round(((profile.weeklyHours * 52) / 12) * 10) / 10
    if (Number.isFinite(maxH) && maxH > avail * 1.2) {
      risks.push({
        risk: `想定稼働（最大${maxH}h/月）が利用可能時間（約${avail}h/月）を超える可能性`,
        evidence: hoursMatch[0],
      })
    }
  }

  for (const ng of profile.ngConditions || []) {
    if (ng && text.includes(ng)) {
      risks.push({
        risk: `NG条件「${ng}」に該当する記載がある`,
        evidence: ng,
      })
    }
  }

  return risks.slice(0, 8)
}

export function buildMatchedExperiences(
  profile: UserProfile,
  assessments: RequirementAssessment[],
  body: string,
): MatchedExperience[] {
  const out: MatchedExperience[] = []
  const matchedReqs = assessments.filter((a) => a.status === 'matched' || a.status === 'transferable')

  for (const a of matchedReqs) {
    const skill = practicalSkills(profile).find((s) => skillMatchesRequirement(s.name, a.requirement))
    if (skill) {
      out.push({
        text: `${skill.name}の実務経験`,
        evidenceSource: `スキル: ${skill.name}（${skill.level}）`,
      })
      continue
    }
    const ach = (profile.achievements || []).find((x) => achievementMatches(x, a.requirement))
    if (ach) {
      out.push({
        text: ach.title,
        evidenceSource: `実績: ${ach.title}`,
      })
    }
  }

  // 案件文面に出てくる業務テーマと実績の接点
  for (const ach of profile.achievements || []) {
    if (out.length >= 3) break
    const keywords = [ach.title, ...(ach.tech || [])].filter(Boolean)
    if (keywords.some((k) => k.length >= 2 && body.includes(k))) {
      if (!out.some((o) => o.text === ach.title)) {
        out.push({ text: ach.title, evidenceSource: `実績: ${ach.title}` })
      }
    }
  }

  return out.slice(0, 3)
}

export function buildGaps(assessments: RequirementAssessment[], risks: ConditionRisk[]): string[] {
  const gaps: string[] = []
  for (const a of assessments.filter((x) => x.importance === 'required')) {
    if (a.status === 'missing') gaps.push(`不足: ${a.requirement}`)
    if (a.status === 'unverified') gaps.push(`未確認: ${a.requirement}`)
    if (a.status === 'transferable') gaps.push(`転用要説明: ${a.requirement}`)
  }
  for (const r of risks) gaps.push(`条件懸念: ${r.risk}`)
  return [...new Set(gaps)].slice(0, 8)
}

export function buildQuestionsToConfirm(
  risks: ConditionRisk[],
  assessments: RequirementAssessment[],
  extraction: ExtractionResult | null,
): string[] {
  const qs: string[] = []
  if (risks.some((r) => /正社員|社員/.test(r.risk))) {
    qs.push('正社員転換を前提としない副業参画が可能か')
  }
  if (risks.some((r) => /日中|MTG/.test(r.risk))) {
    qs.push('平日日中のMTG頻度')
  }
  if (risks.some((r) => /稼働/.test(r.risk)) || !extraction?.workDays?.text) {
    qs.push('具体的な稼働時間')
  }
  if (assessments.some((a) => a.status === 'missing' || a.status === 'unverified')) {
    const miss = assessments.find((a) => a.importance === 'required' && (a.status === 'missing' || a.status === 'unverified'))
    if (miss) qs.push(`必須技術「${miss.requirement}」の経験年数・必須度`)
  }
  if (risks.some((r) => /報酬/.test(r.risk)) || extraction?.budget?.provenance === 'unknown') {
    qs.push('報酬・契約形態')
  }
  if (risks.some((r) => /責任|範囲/.test(r.risk))) {
    qs.push('担当範囲')
  }
  if (qs.length < 3) qs.push('副業のまま継続可能か')
  return [...new Set(qs)].slice(0, 3)
}

export function mapActionToLegacyRecommendation(
  action: RecommendedAction,
): 'apply' | 'question' | 'skip' {
  if (action === 'apply') return 'apply'
  if (action === 'skip') return 'skip'
  return 'question'
}

export function judgmentLabelFor(
  action: RecommendedAction,
  priority: ApplicationPriority,
): JudgmentLabel {
  if (action === 'skip') return '見送り'
  if (action === 'apply' && priority === 'high') return '攻め時'
  return '様子見'
}

export function overallScoreFor(action: RecommendedAction, priority: ApplicationPriority): number {
  const base =
    action === 'apply' ? 78 : action === 'casual_talk' ? 62 : action === 'confirm_conditions' ? 48 : 22
  const adj = priority === 'high' ? 10 : priority === 'low' ? -12 : 0
  return Math.max(0, Math.min(100, base + adj))
}

export interface ApplicationDecisionInput {
  body: string
  title: string
  profile: UserProfile
  extraction: ExtractionResult | null
  legacyRecommendation: 'apply' | 'question' | 'skip'
  legacyReason: string
  evidences?: RequirementEvidence[]
  applicationType?: ApplicationType
  catchUpAllowed?: boolean
}

export interface ApplicationDecision {
  recommendedAction: RecommendedAction
  applicationPriority: ApplicationPriority
  judgmentLabel: JudgmentLabel
  overallScore: number
  decisionReason: string
  requirements: RequirementAssessment[]
  matchedExperiences: MatchedExperience[]
  gaps: string[]
  conditionRisks: ConditionRisk[]
  questionsToConfirm: string[]
  confidence: 'high' | 'medium' | 'low'
}

/**
 * 決定的な応募アクション判定。金額・BLOCK 由来の legacyRecommendation を尊重しつつ拡張する。
 */
export function decideApplicationAction(input: ApplicationDecisionInput): ApplicationDecision {
  const assessments = buildRequirementAssessments(input.extraction, input.profile, input.evidences)
  const risks = detectConditionRisks(input.body, input.title, input.profile, input.extraction)
  const matchedExperiences = buildMatchedExperiences(input.profile, assessments, input.body)
  const gaps = buildGaps(assessments, risks)
  const questionsToConfirm = buildQuestionsToConfirm(risks, assessments, input.extraction)

  const required = assessments.filter((a) => a.importance === 'required')
  const missingRequired = required.filter((a) => a.status === 'missing')
  const matchedRequired = required.filter((a) => a.status === 'matched')
  const transferableRequired = required.filter((a) => a.status === 'transferable')
  const unverifiedRequired = required.filter((a) => a.status === 'unverified')

  const fullTimeTrial = risks.some((r) => /正社員|社員登用|採用前提|お試し/.test(r.risk))
  const scheduleConflict = risks.some((r) => /日中|常時|稼働/.test(r.risk))
  const specializedMissing = missingRequired.some((a) =>
    /音声|信号|アルゴリズム|研究開発|機械学習|saas|karte|専用/.test(normalizeKey(a.requirement)),
  )

  const catchUp =
    input.catchUpAllowed ??
    /キャッチアップ|未経験可|歓迎|学べる|不問/.test(`${input.title}\n${input.body}`)

  let action: RecommendedAction
  let priority: ApplicationPriority
  let reason: string
  let confidence: 'high' | 'medium' | 'low' = 'medium'

  if (input.legacyRecommendation === 'skip' && /BLOCK|NG条件|大幅に超|大幅に下回/.test(input.legacyReason)) {
    action = 'skip'
    priority = 'low'
    reason = input.legacyReason
    confidence = 'high'
  } else if (fullTimeTrial) {
    action = 'confirm_conditions'
    priority = 'low'
    reason =
      '正社員採用前提のお試し参画の可能性があるため、継続副業として成立するか確認してから判断してください。'
    confidence = 'high'
  } else if (specializedMissing && missingRequired.length > 0 && matchedRequired.length === 0) {
    action = catchUp ? 'casual_talk' : 'skip'
    priority = 'low'
    reason = catchUp
      ? '必須の専門経験が不足しています。通常応募より、不足を開示したうえで話を聞く方が適切です。'
      : '必須の専門経験がプロフィール上確認できないため、見送りまたは低優先度の接点探索が妥当です。'
    confidence = 'high'
  } else if (missingRequired.length > 0 && matchedRequired.length === 0 && !catchUp) {
    action = scheduleConflict ? 'skip' : 'casual_talk'
    priority = 'low'
    reason =
      '必須要件の実務経験が確認できません。興味や関心領域だけで充足とみなさず、カジュアルな確認か見送りを推奨します。'
  } else if (missingRequired.length > 0 && (matchedRequired.length > 0 || transferableRequired.length > 0) && catchUp) {
    action = 'casual_talk'
    priority = matchedRequired.length >= transferableRequired.length ? 'medium' : 'low'
    reason =
      '必須要件の一部に強みがあり、残りはキャッチアップ可と読めるため、カジュアル面談・話を聞きたいを推奨します。'
  } else if (unverifiedRequired.length > 0 || input.legacyRecommendation === 'question') {
    action = scheduleConflict || fullTimeTrial ? 'confirm_conditions' : 'confirm_conditions'
    priority = 'medium'
    reason =
      input.legacyReason ||
      '条件または必須要件に未確認事項があるため、確認してから判断してください。'
  } else if (scheduleConflict && matchedRequired.length > 0) {
    action = 'confirm_conditions'
    priority = 'medium'
    reason = 'スキル接点はある一方、稼働条件の不一致リスクがあるため条件確認を推奨します。'
  } else if (
    input.legacyRecommendation === 'apply' &&
    missingRequired.length === 0 &&
    unverifiedRequired.length === 0
  ) {
    action = input.applicationType === 'casual_talk' || input.applicationType === 'hear_more'
      ? 'casual_talk'
      : 'apply'
    priority = matchedRequired.length >= 2 ? 'high' : 'medium'
    reason =
      action === 'casual_talk'
        ? '応募形式がカジュアル面談系のため、話を聞きたいアクションを推奨します。'
        : input.legacyReason || '必須要件と稼働・採算の条件を満たしており、応募を推奨します。'
    confidence = 'high'
  } else if (matchedRequired.length > 0 || transferableRequired.length > 0) {
    action = 'casual_talk'
    priority = 'medium'
    reason = '技術の完全一致は限定的ですが、近い業務経験があるため話を聞く価値があります。'
  } else {
    action = 'confirm_conditions'
    priority = 'low'
    reason = '情報が不足しているため、条件を確認してから判断してください。'
    confidence = 'low'
  }

  // 入力の応募形式が「話を聞きたい」で skip 以外なら casual_talk を優先表示可
  if (
    (input.applicationType === 'casual_talk' || input.applicationType === 'hear_more') &&
    action === 'apply'
  ) {
    action = 'casual_talk'
    reason = `${reason}（応募形式に合わせカジュアル面談を推奨）`
  }

  return {
    recommendedAction: action,
    applicationPriority: priority,
    judgmentLabel: judgmentLabelFor(action, priority),
    overallScore: overallScoreFor(action, priority),
    decisionReason: reason,
    requirements: assessments,
    matchedExperiences,
    gaps,
    conditionRisks: risks,
    questionsToConfirm,
    confidence,
  }
}

/** YouTrust 興味対象の決定的推薦 */
export function recommendYoutrustInterestTarget(
  body: string,
  companyName?: string,
  recruiterName?: string,
): 'content' | 'person' | 'company' | 'other' {
  if (recruiterName?.trim() && /担当|さん|様/.test(body)) return 'person'
  if (companyName?.trim() && (body.includes(companyName) || /事業|プロダクト|会社/.test(body))) return 'company'
  if (/課題|改善|運用|開発|募集内容/.test(body)) return 'content'
  return 'content'
}

export const YOUTRUST_INTEREST_LABELS = {
  content: '募集内容に興味がある',
  person: '募集している人に興味がある',
  company: '募集している会社、事業に興味がある',
  other: 'その他（ほかに話したいテーマがある）',
} as const
