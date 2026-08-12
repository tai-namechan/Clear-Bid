export type Platform = 'youtrust' | 'crowdworks' | 'coconala' | 'lancers' | 'flexy' | 'other'
export type BudgetType = 'fixed' | 'hourly' | 'monthly' | 'performance' | 'unknown'
export type EngagementType = 'project' | 'ongoing' | 'unknown'
export type ApplicationType = 'standard' | 'casual_talk' | 'hear_more' | 'unknown'
export type RecommendedAction = 'apply' | 'casual_talk' | 'confirm_conditions' | 'skip'
export type ApplicationPriority = 'high' | 'medium' | 'low'
export type JudgmentLabel = '攻め時' | '様子見' | '見送り'
export type RequirementMatchStatus = 'matched' | 'transferable' | 'unverified' | 'missing'
export type RequirementImportance = 'required' | 'preferred'
export type YoutrustInterestTarget = 'content' | 'person' | 'company' | 'other'

export type StatusCode =
  | 'draft'
  | 'extracted'
  | 'diagnosing'
  | 'review'
  | 'needs_question'
  | 'skipped'
  | 'casual_sent'
  | 'applied'
  | 'replied'
  | 'interview'
  | 'won'
  | 'working'
  | 'delivered'
  | 'completed'
  | 'paid'
  | 'lost'
  | 'cancelled'

export type SkillLevel = '実務' | '個人開発' | '学習中'
export type Recommendation = 'apply' | 'question' | 'skip'
export type AxisRating = 'good' | 'attention' | 'check' | 'unknown'

export type RequirementEvidenceStatus =
  | 'supported'
  | 'partial'
  | 'unverified'
  | 'unsupported'

export interface RequirementEvidence {
  requirement: string
  status: RequirementEvidenceStatus
  evidenceNote: string
  sourceQuote: string
}

export interface RequirementAssessment {
  requirement: string
  importance: RequirementImportance
  status: RequirementMatchStatus
  reason: string
  howToHandle: string
}

export interface MatchedExperience {
  text: string
  evidenceSource: string
}

export interface ConditionRisk {
  risk: string
  evidence: string
}

export interface ProfileSkill {
  id?: string
  name: string
  level: SkillLevel
  years?: number
  usableInProposal?: boolean
}

export interface ProfileAchievement {
  id?: string
  title: string
  problem?: string
  action?: string
  result?: string
  metrics?: string
  tech?: string[]
  usableInProposal?: boolean
}

export interface InterestAreas {
  technologies: string[]
  companies: string[]
  domains: string[]
}

export interface UserProfile {
  name: string
  bio: string
  weeklyHours: number
  minHourlyYen: number
  minContractYen: number
  availableTimes: string
  mtgLimit: string
  capacity: string
  skills: ProfileSkill[]
  achievements: ProfileAchievement[]
  ngConditions: string[]
  /** 関心のある技術・企業・領域（スキルマッチ加点には使わない） */
  interestAreas: InterestAreas
  platform: Platform
  feeRate: number
}

export interface ClientInfo {
  rating: string
  reviews: string
  orders: string
  completionRate: string
  verified: boolean
  certified: boolean
}

export interface JobInput {
  platform: Platform
  title: string
  body: string
  url?: string
  sourceJobId?: string
  /** 会社名 */
  companyName?: string
  /** 募集者名（任意） */
  recruiterName?: string
  /** 応募形式 */
  applicationType?: ApplicationType
  budgetType: BudgetType
  budgetMin: string
  budgetMax: string
  deadline: string
  applicants: string
  clientRating: string
  clientReviews: string
  clientOrders: string
  clientCompletionRate: string
  clientVerified: boolean
  clientCertified: boolean
  /** project=単発 / ongoing=継続 / unknown */
  engagementType?: EngagementType
  /** 想定月間稼働時間（下限）。空欄は不明のまま補完しない */
  expectedMonthlyHoursMin?: string
  /** 想定月間稼働時間（上限） */
  expectedMonthlyHoursMax?: string
  /** 案件単位の手数料率（%）。空欄時はプラットフォーム初期値→プロフィール */
  feeRatePercent?: string
}

export type { Opportunity as PipelineItem, Opportunity, PipelineEvent, WorkLog, FinancialResult, ClientSnapshot } from './opportunity'
export { emptyFinancial, normalizeOpportunity } from './opportunity'

export interface AppStats {
  diagnosed: number
  applied: number
  replied: number
  interviews: number
  won: number
  completed: number
  paid: number
  skipped: number
  contractTotal: number
  paidTotal: number
}

export const INIT_PROFILE: UserProfile = {
  name: '',
  bio: '',
  weeklyHours: 10,
  minHourlyYen: 2000,
  minContractYen: 30000,
  availableTimes: '平日21-24時、土日終日',
  mtgLimit: '週1回まで',
  capacity: 'あと1件受けられる',
  skills: [],
  achievements: [],
  ngConditions: ['常時対応必須', '仮払い前作業'],
  interestAreas: { technologies: [], companies: [], domains: [] },
  platform: 'crowdworks',
  feeRate: 20,
}

export const INIT_STATS: AppStats = {
  diagnosed: 0,
  applied: 0,
  replied: 0,
  interviews: 0,
  won: 0,
  completed: 0,
  paid: 0,
  skipped: 0,
  contractTotal: 0,
  paidTotal: 0,
}

export const INIT_JOB_INPUT: JobInput = {
  platform: 'crowdworks',
  title: '',
  body: '',
  url: '',
  companyName: '',
  recruiterName: '',
  applicationType: 'unknown',
  budgetType: 'fixed',
  budgetMin: '',
  budgetMax: '',
  deadline: '',
  applicants: '',
  clientRating: '',
  clientReviews: '',
  clientOrders: '',
  clientCompletionRate: '',
  clientVerified: false,
  clientCertified: false,
  engagementType: 'project',
  expectedMonthlyHoursMin: '',
  expectedMonthlyHoursMax: '',
  feeRatePercent: '',
}

const VALID_PLATFORMS = new Set<Platform>([
  'youtrust',
  'crowdworks',
  'coconala',
  'lancers',
  'flexy',
  'other',
])
const VALID_ENGAGEMENT = new Set<EngagementType>(['project', 'ongoing', 'unknown'])
const VALID_BUDGET = new Set<BudgetType>(['fixed', 'hourly', 'monthly', 'performance', 'unknown'])
const VALID_APPLICATION_TYPE = new Set<ApplicationType>([
  'standard',
  'casual_talk',
  'hear_more',
  'unknown',
])

function normalizeInterestAreasField(raw: unknown): InterestAreas {
  const empty: InterestAreas = { technologies: [], companies: [], domains: [] }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : []
  return {
    technologies: list(o.technologies),
    companies: list(o.companies),
    domains: list(o.domains),
  }
}

/** 旧 localStorage / D1 プロフィールを後方互換で正規化 */
export function normalizeProfile(raw: Partial<UserProfile> | null | undefined): UserProfile {
  const base = { ...INIT_PROFILE, interestAreas: { technologies: [], companies: [], domains: [] } }
  if (!raw || typeof raw !== 'object') return base
  const platform = VALID_PLATFORMS.has(raw.platform as Platform)
    ? (raw.platform as Platform)
    : base.platform
  return {
    ...base,
    ...raw,
    platform,
    name: typeof raw.name === 'string' ? raw.name : base.name,
    bio: typeof raw.bio === 'string' ? raw.bio : base.bio,
    weeklyHours: Number.isFinite(Number(raw.weeklyHours)) ? Number(raw.weeklyHours) : base.weeklyHours,
    minHourlyYen: Number.isFinite(Number(raw.minHourlyYen)) ? Number(raw.minHourlyYen) : base.minHourlyYen,
    minContractYen: Number.isFinite(Number(raw.minContractYen)) ? Number(raw.minContractYen) : base.minContractYen,
    availableTimes: typeof raw.availableTimes === 'string' ? raw.availableTimes : base.availableTimes,
    mtgLimit: typeof raw.mtgLimit === 'string' ? raw.mtgLimit : base.mtgLimit,
    capacity: typeof raw.capacity === 'string' ? raw.capacity : base.capacity,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    ngConditions: Array.isArray(raw.ngConditions) ? raw.ngConditions : base.ngConditions,
    interestAreas: normalizeInterestAreasField(raw.interestAreas),
    feeRate: Number.isFinite(Number(raw.feeRate)) ? Number(raw.feeRate) : base.feeRate,
  }
}

/** 旧 JobInput / 下書きを後方互換で正規化 */
export function normalizeJobInput(raw: Partial<JobInput> | null | undefined): JobInput {
  const base = { ...INIT_JOB_INPUT }
  if (!raw || typeof raw !== 'object') return base
  const platform = VALID_PLATFORMS.has(raw.platform as Platform)
    ? (raw.platform as Platform)
    : base.platform
  const budgetType = VALID_BUDGET.has(raw.budgetType as BudgetType)
    ? (raw.budgetType as BudgetType)
    : base.budgetType
  const engagementType = VALID_ENGAGEMENT.has(raw.engagementType as EngagementType)
    ? (raw.engagementType as EngagementType)
    : platform === 'flexy'
      ? 'ongoing'
      : base.engagementType
  const applicationType = VALID_APPLICATION_TYPE.has(raw.applicationType as ApplicationType)
    ? (raw.applicationType as ApplicationType)
    : base.applicationType
  return {
    ...base,
    ...raw,
    platform,
    budgetType,
    engagementType,
    applicationType,
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    companyName: typeof raw.companyName === 'string' ? raw.companyName : '',
    recruiterName: typeof raw.recruiterName === 'string' ? raw.recruiterName : '',
    budgetMin: raw.budgetMin != null ? String(raw.budgetMin) : '',
    budgetMax: raw.budgetMax != null ? String(raw.budgetMax) : '',
    deadline: typeof raw.deadline === 'string' ? raw.deadline : '',
    applicants: raw.applicants != null ? String(raw.applicants) : '',
    clientRating: typeof raw.clientRating === 'string' ? raw.clientRating : '',
    clientReviews: raw.clientReviews != null ? String(raw.clientReviews) : '',
    clientOrders: raw.clientOrders != null ? String(raw.clientOrders) : '',
    clientCompletionRate: typeof raw.clientCompletionRate === 'string' ? raw.clientCompletionRate : '',
    clientVerified: Boolean(raw.clientVerified),
    clientCertified: Boolean(raw.clientCertified),
    expectedMonthlyHoursMin:
      raw.expectedMonthlyHoursMin != null ? String(raw.expectedMonthlyHoursMin) : '',
    expectedMonthlyHoursMax:
      raw.expectedMonthlyHoursMax != null ? String(raw.expectedMonthlyHoursMax) : '',
    feeRatePercent: raw.feeRatePercent != null ? String(raw.feeRatePercent) : '',
  }
}
