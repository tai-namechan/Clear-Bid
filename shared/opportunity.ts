import type {
  ApplicationType,
  Platform,
  Recommendation,
  RecommendedAction,
  StatusCode,
} from './types'

export type { Platform, Recommendation, StatusCode }

export interface PipelineEvent {
  id: string
  fromStatus: StatusCode | null
  toStatus: StatusCode
  reasonCode?: string
  note?: string
  createdAt: string
}

export interface WorkLog {
  id: string
  category: string
  minutes: number
  note?: string
  workedOn: string
  createdAt: string
}

export interface FinancialResult {
  contractYen: number
  feeYen: number
  withholdingYen: number
  expenseYen: number
  preTaxTakeHomeYen: number
  paidAt?: string | null
  completedAt?: string | null
}

export interface ClientSnapshot {
  rating: string
  reviews: string
  orders: string
  completionRate: string
  verified: boolean
  certified: boolean
}

/** Full opportunity record used by pipeline + detail (Phase 1). */
export interface Opportunity {
  id: string
  title: string
  platform: Platform
  status: StatusCode
  date: string
  updatedAt: string
  body?: string
  url?: string
  sourceJobId?: string
  companyName?: string
  recruiterName?: string
  applicationType?: ApplicationType
  budgetType?: string
  budgetMin?: string
  budgetMax?: string
  deadline?: string
  applicants?: string
  recommendation?: Recommendation
  recommendedAction?: RecommendedAction
  actualAction?: RecommendedAction | string
  generatedMessage?: string
  appliedAt?: string
  strategy?: string
  skipReason?: string
  note?: string
  client?: ClientSnapshot
  events: PipelineEvent[]
  workLogs: WorkLog[]
  financial?: FinancialResult | null
  estimatedLikelyHours?: number
  estimatedMaxHours?: number
  /** Phase 2: diagnosis history (append-only versions). */
  diagnosisVersions?: DiagnosisVersionRecord[]
  replies?: ReplyRecord[]
}

export interface DiagnosisVersionRecord {
  id: string
  version: number
  createdAt: string
  recommendation?: Recommendation
  recommendationReason?: string
  recommendedAction?: RecommendedAction
  userDecision?: string
  extraction?: unknown
  safety?: unknown
  effort?: unknown
  axes?: unknown
  proposal?: unknown
  diagnosisSnapshot?: unknown
}

export interface ReplyRecord {
  id: string
  body: string
  createdAt: string
  extracted?: unknown
  draftReply?: string
}

/** Backward-compatible alias used by list cards. */
export type PipelineItem = Opportunity

export function emptyFinancial(): FinancialResult {
  return {
    contractYen: 0,
    feeYen: 0,
    withholdingYen: 0,
    expenseYen: 0,
    preTaxTakeHomeYen: 0,
    paidAt: null,
    completedAt: null,
  }
}

export function normalizeOpportunity(raw: Partial<Opportunity> & { id: string; title: string; platform: Platform; status: StatusCode; date: string }): Opportunity {
  return {
    id: raw.id,
    title: raw.title,
    platform: raw.platform,
    status: raw.status,
    date: raw.date,
    updatedAt: raw.updatedAt || raw.date,
    body: raw.body,
    url: raw.url,
    sourceJobId: raw.sourceJobId,
    companyName: raw.companyName,
    recruiterName: raw.recruiterName,
    applicationType: raw.applicationType,
    budgetType: raw.budgetType,
    budgetMin: raw.budgetMin,
    budgetMax: raw.budgetMax,
    deadline: raw.deadline,
    applicants: raw.applicants,
    recommendation: raw.recommendation,
    recommendedAction: raw.recommendedAction,
    actualAction: raw.actualAction,
    generatedMessage: raw.generatedMessage,
    appliedAt: raw.appliedAt,
    strategy: raw.strategy,
    skipReason: raw.skipReason,
    note: raw.note,
    client: raw.client,
    events: raw.events || [],
    workLogs: raw.workLogs || [],
    financial: raw.financial ?? null,
    estimatedLikelyHours: raw.estimatedLikelyHours,
    estimatedMaxHours: raw.estimatedMaxHours,
    diagnosisVersions: raw.diagnosisVersions || [],
    replies: raw.replies || [],
  }
}
