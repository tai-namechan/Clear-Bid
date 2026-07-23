export type Platform = 'crowdworks' | 'coconala' | 'lancers' | 'other'
export type BudgetType = 'fixed' | 'hourly' | 'monthly' | 'performance' | 'unknown'
export type StatusCode =
  | 'draft'
  | 'extracted'
  | 'diagnosing'
  | 'review'
  | 'needs_question'
  | 'skipped'
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
}
