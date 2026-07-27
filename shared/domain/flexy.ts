import { DEFAULT_FEE_RATES } from '../constants'
import type {
  EngagementType,
  JobInput,
  Platform,
  RequirementEvidence,
  RequirementEvidenceStatus,
  UserProfile,
} from '../types'
import type { ExtractionResult } from '../schemas/ai'

/** 全角数字・カンマを半角へ。 */
export function normalizeDigits(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,]/g, '')
    .replace(/万円/g, '0000')
    .replace(/万/g, '0000')
}

export interface FlexyBudgetParse {
  budgetType: 'monthly' | 'unknown'
  budgetMinYen: number | null
  budgetMaxYen: number | null
  rawText: string
}

/**
 * FLEXY 報酬表記の決定的パーサ。
 * 「〜72万円／月」「40〜60万円/月」等。上限のみの場合 min は null。
 */
export function parseFlexyBudget(text: string): FlexyBudgetParse {
  const src = text.replace(/\s+/g, '')
  const monthlyHint = /月|\/月|／月/.test(src)
  if (!monthlyHint && !/報酬|単価/.test(text)) {
    return { budgetType: 'unknown', budgetMinYen: null, budgetMaxYen: null, rawText: '' }
  }

  // 40〜60万円 / 40-60万
  const range = src.match(
    /(?:報酬[:：]?)?(?:約)?([0-9０-９,.，]+)\s*[〜~\-－–]\s*([0-9０-９,.，]+)\s*万?\s*円?(?:[／/]?月)?/,
  )
  if (range && range[1] && range[2]) {
    const minRaw = range[1]
    const maxRaw = range[2]
    const min = Number(normalizeDigits(minRaw.includes('万') ? minRaw : `${minRaw}万`))
    const max = Number(normalizeDigits(maxRaw.includes('万') ? maxRaw : `${maxRaw}万`))
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return {
        budgetType: 'monthly',
        budgetMinYen: Math.round(min),
        budgetMaxYen: Math.round(max),
        rawText: range[0],
      }
    }
  }

  // 〜72万円／月 / 上限72万
  const upperOnly = src.match(
    /(?:報酬[:：]?)?(?:〜|~|～|上限)?\s*([0-9０-９,.，]+)\s*万?\s*円?\s*[／/]?月/,
  )
  if (upperOnly && upperOnly[1]) {
    const rawNum = upperOnly[1]
    const asMan = /万/.test(upperOnly[0]) || Number(normalizeDigits(rawNum)) < 1000
    const yen = Number(normalizeDigits(asMan ? `${rawNum}万` : rawNum))
    if (Number.isFinite(yen) && yen > 0) {
      return {
        budgetType: 'monthly',
        budgetMinYen: null,
        budgetMaxYen: Math.round(yen),
        rawText: upperOnly[0],
      }
    }
  }

  return {
    budgetType: monthlyHint ? 'monthly' : 'unknown',
    budgetMinYen: null,
    budgetMaxYen: null,
    rawText: '',
  }
}

export interface FlexyWorkDaysParse {
  workDaysText: string
  minDays: number | null
  maxDays: number | null
}

/** 「週5日」「週2〜3日」をパース。月間時間への換算はしない。 */
export function parseFlexyWorkDays(text: string): FlexyWorkDaysParse | null {
  const m = text.match(/週\s*([0-9０-９]+)\s*(?:[〜~\-－–]\s*([0-9０-９]+))?\s*日/)
  if (!m || !m[1]) return null
  const minDays = Number(normalizeDigits(m[1]))
  const maxDays = m[2] ? Number(normalizeDigits(m[2])) : minDays
  return {
    workDaysText: m[0].replace(/\s+/g, ''),
    minDays: Number.isFinite(minDays) ? minDays : null,
    maxDays: Number.isFinite(maxDays) ? maxDays : null,
  }
}

/** 月間稼働時間の記載有無（数値があれば true）。週N日だけでは false。 */
export function hasMonthlyHoursMention(text: string): boolean {
  return /月\s*[0-9０-９]+\s*時間|月間\s*[0-9０-９]+\s*時間|[0-9０-９]+\s*時間\s*[/／]?\s*月/.test(text)
}

/** 利用可能月間時間 = weeklyHours * 52 / 12 */
export function availableMonthlyHours(weeklyHours: number): number {
  if (!Number.isFinite(weeklyHours) || weeklyHours < 0) return 0
  return Math.round(((weeklyHours * 52) / 12) * 10) / 10
}

/** 案件手数料率。案件指定 >（FLEXYはPF初期値0%）> プロフィール > PF初期値 */
export function resolveJobFeeRate(params: {
  platform: Platform | string
  jobFeeRatePercent?: string | number | null
  profileFeeRate?: number | null
}): number {
  const raw = params.jobFeeRatePercent
  if (raw !== '' && raw != null) {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  if (params.platform === 'flexy') {
    return DEFAULT_FEE_RATES.flexy ?? 0
  }
  if (params.profileFeeRate != null && Number.isFinite(params.profileFeeRate)) {
    return params.profileFeeRate
  }
  const platformDefault = DEFAULT_FEE_RATES[params.platform]
  if (platformDefault != null) return platformDefault
  return 20
}

/**
 * 安全側実質時給（月額継続）。
 * 下限報酬と月間最大時間がある場合のみ算出。上限のみ・時間なしは null。
 */
export function safeMonthlyEffectiveHourly(params: {
  budgetMinYen: number | null
  monthlyHoursMax: number | null
  feeRatePercent: number
}): number | null {
  if (params.budgetMinYen == null || params.budgetMinYen <= 0) return null
  if (params.monthlyHoursMax == null || params.monthlyHoursMax <= 0) return null
  const fee = Math.floor((params.budgetMinYen * params.feeRatePercent) / 100)
  const take = Math.max(0, params.budgetMinYen - fee)
  return Math.round(take / params.monthlyHoursMax)
}

/** 複合必須要件を原子的に分割（・区切りの技術要素など）。 */
export function splitAtomicRequirements(line: string): string[] {
  const cleaned = line.replace(/^[・●◆■\-–—\s]+/, '').trim()
  if (!cleaned) return []

  // LLM API・RAG・構造化出力を活用した機能の構築経験
  const compound = cleaned.match(
    /^(.+?)を活用した(.+)$/,
  )
  if (compound?.[1] && compound[2] && /[・、,]/.test(compound[1])) {
    const parts = compound[1].split(/[・、,]/).map((p) => p.trim()).filter(Boolean)
    const suffix = compound[2].trim()
    if (parts.length >= 2) {
      return parts.map((p) => `${p}を活用した${suffix}`)
    }
  }

  // 単純な中点列挙で短い技術名のみ
  if (/[・]/.test(cleaned) && cleaned.length < 80) {
    const parts = cleaned.split(/[・]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2 && parts.every((p) => p.length <= 40)) {
      return parts
    }
  }

  return [cleaned]
}

const SKILL_ALIASES: Record<string, string[]> = {
  'llm api': ['llm api', 'llmapi', 'openai api', 'claude api', 'gemini api', '生成ai api'],
  rag: ['rag', 'retrieval-augmented', 'retrieval augmented'],
  構造化出力: ['構造化出力', 'structured output', 'json mode'],
  git: ['git', 'github'],
  github: ['git', 'github'],
  生成ai: ['生成ai', '生成aiの日常的な業務活用', 'chatgpt', 'claude'],
}

function normalizeSkillKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function aliasKeysFor(requirement: string): string[] {
  const n = normalizeSkillKey(requirement)
  const keys: string[] = [n]
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.some((a) => n.includes(a)) || n.includes(canonical)) {
      keys.push(canonical, ...aliases)
    }
  }
  return [...new Set(keys)]
}

/**
 * 登録スキルとの決定的一致のみ候補提示。部分一致で supported にしない。
 * RAG と LLM API は別スキル扱い。
 */
export function suggestEvidenceStatus(
  requirement: string,
  profile: Pick<UserProfile, 'skills' | 'achievements'>,
): { status: RequirementEvidenceStatus; note: string } {
  const skillNames = (profile.skills || []).map((s) => normalizeSkillKey(s.name))
  const achievementText = (profile.achievements || [])
    .flatMap((a) => [a.title, a.tech?.join(' ') || '', a.result || ''])
    .map(normalizeSkillKey)
    .join(' ')

  const keys = aliasKeysFor(requirement)
  const exactSkill = skillNames.some((sk) =>
    keys.some((k) => sk === k || sk === normalizeSkillKey(requirement)),
  )
  if (exactSkill) {
    return { status: 'supported', note: '登録スキルと一致（要・根拠メモ確認）' }
  }

  const reqNorm = normalizeSkillKey(requirement)
  // 明示 alias 一致のみ。includes の緩い部分一致は partial 候補に留める
  const aliasHit = skillNames.some((sk) =>
    keys.some((k) => k !== reqNorm && (sk === k || sk.includes(k) && k.length >= 3)),
  )
  if (aliasHit) {
    return { status: 'partial', note: '近いスキルあり。完全一致ではないため本人確認が必要' }
  }

  const inAchievement = keys.some((k) => k.length >= 3 && achievementText.includes(k))
  if (inAchievement) {
    return { status: 'partial', note: '実績テキストに近い記載あり。本人確認が必要' }
  }

  return { status: 'unverified', note: '' }
}

export function initRequirementEvidences(
  requirements: Array<{ text: string; quote?: string }>,
  profile: Pick<UserProfile, 'skills' | 'achievements'>,
): RequirementEvidence[] {
  return requirements.map((r) => {
    const suggestion = suggestEvidenceStatus(r.text, profile)
    // 自動で supported にはしない。候補は partial/unverified に留め、本人確認を必須化
    const status: RequirementEvidenceStatus =
      suggestion.status === 'supported' ? 'partial' : suggestion.status
    return {
      requirement: r.text,
      status,
      evidenceNote: suggestion.note,
      sourceQuote: r.quote || '',
    }
  })
}

export function hasBlockingEvidenceGaps(evidences: RequirementEvidence[]): boolean {
  return evidences.some((e) => e.status === 'unverified' || e.status === 'partial')
}

export function hasUnsupportedRequirement(evidences: RequirementEvidence[]): boolean {
  return evidences.some((e) => e.status === 'unsupported')
}

export function supportedEvidencesOnly(evidences: RequirementEvidence[]): RequirementEvidence[] {
  return evidences.filter((e) => e.status === 'supported' && e.evidenceNote.trim())
}

export function parseHoursField(raw: string | undefined | null): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number(String(raw).trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

export function isOngoingEngagement(
  engagementType: EngagementType | undefined,
  budgetType: string | undefined,
): boolean {
  return engagementType === 'ongoing' || budgetType === 'monthly'
}

/** FLEXY 募集文から構造をヒューリスティック抽出（AIフォールバック用）。 */
export function extractFlexyHeuristics(title: string, body: string): Partial<ExtractionResult> {
  const text = `${title}\n${body}`
  const item = (t: string, quote = t) =>
    ({ text: t, provenance: 'confirmed' as const, quote })

  const roleMatch = text.match(/職種[:：]\s*([^\n]+)/)
  const companyMatch = text.match(/(?:会社名|企業名|クライアント)[:：]\s*([^\n]+)/)
  const locationMatch = text.match(/(?:勤務地)[:：]\s*([^\n]+)/)
  const remote =
    /フルリモート|リモート可|リモート勤務/.exec(text)?.[0] ||
    (/出社/.test(text) ? '出社条件あり' : '')
  const workDays = parseFlexyWorkDays(text)
  const availability = /ビジネスタイム以外[^\n]*|対応時間帯[:：][^\n]+|稼働時間帯[:：][^\n]+/.exec(text)?.[0]
  const budget = parseFlexyBudget(text)
  const background = text.match(/(?:募集背景|背景)[:：]?\s*([^\n]+)/)

  const requiredBlock = body.split(/必須要件/)[1]?.split(/歓迎要件|応募|待遇|報酬/)[0] || ''
  const preferredBlock = body.split(/歓迎要件/)[1]?.split(/応募|待遇|報酬|必須/)[0] || ''

  const parseReqLines = (block: string) => {
    const lines = block.split(/\n+/).map((l) => l.trim()).filter((l) => /^[・●◆■\-–—]/.test(l) || (l.length > 8 && !/[:：]/.test(l.slice(0, 6))))
    const items: Array<{ text: string; provenance: 'confirmed'; quote: string }> = []
    for (const line of lines) {
      for (const atomic of splitAtomicRequirements(line)) {
        items.push({ text: atomic, provenance: 'confirmed', quote: line.replace(/^[・●◆■\-–—\s]+/, '').trim() })
      }
    }
    return items
  }

  const requiredRequirements = parseReqLines(requiredBlock)
  const preferredRequirements = parseReqLines(preferredBlock)

  const unknowns: string[] = []
  if (!hasMonthlyHoursMention(text)) unknowns.push('月間稼働時間')
  if (!workDays) unknowns.push('稼働日数')
  if (budget.budgetMinYen == null && budget.budgetMaxYen != null) {
    unknowns.push('月額報酬の下限')
  }
  if (!availability) unknowns.push('対応時間帯・日中MTG可否')

  return {
    companyName: companyMatch?.[1]
      ? item(companyMatch[1].trim(), companyMatch[0])
      : undefined,
    role: roleMatch?.[1]
      ? item(roleMatch[1].trim(), roleMatch[0])
      : title
        ? item(title, title)
        : undefined,
    workStyle: remote ? item(remote, remote) : undefined,
    workLocation: locationMatch?.[1]
      ? item(locationMatch[1].trim(), locationMatch[0])
      : undefined,
    workDays: workDays ? item(workDays.workDaysText, workDays.workDaysText) : undefined,
    requiredAvailability: availability ? item(availability.trim(), availability.trim()) : undefined,
    recruitmentBackground: background?.[1]
      ? item(background[1].trim(), background[0])
      : undefined,
    requiredRequirements,
    preferredRequirements,
    budget:
      budget.rawText
        ? item(budget.rawText, budget.rawText)
        : { text: '不明', provenance: 'unknown', quote: '' },
    unknowns,
    requiredSkills: requiredRequirements.map((r) => ({
      text: r.text,
      provenance: 'confirmed' as const,
      quote: r.quote,
    })),
  }
}
