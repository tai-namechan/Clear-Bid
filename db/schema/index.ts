import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

/** Drizzle schema for Cloudflare D1 (spec §14). Phase 0 defines shape; runtime still uses local storage until Access/D1 are wired. */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  timezone: text('timezone').default('Asia/Tokyo'),
  accessSubject: text('access_subject'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(),
  bio: text('bio'),
  weeklyMinutes: integer('weekly_minutes').notNull().default(600),
  minHourlyYen: integer('min_hourly_yen').notNull().default(2000),
  minContractYen: integer('min_contract_yen').default(30000),
  availableTimes: text('available_times'),
  mtgLimit: text('mtg_limit'),
  capacity: text('capacity'),
  ngConditionsJson: text('ng_conditions_json'),
  feeRateDefault: integer('fee_rate_default').default(20),
  updatedAt: text('updated_at').notNull(),
})

export const profileSkills = sqliteTable('profile_skills', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  years: real('years'),
  lastUsedAt: text('last_used_at'),
  usableInProposal: integer('usable_in_proposal').default(1),
})

export const profileAchievements = sqliteTable('profile_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  problem: text('problem'),
  action: text('action'),
  result: text('result'),
  metrics: text('metrics'),
  techJson: text('tech_json'),
  visibility: text('visibility'),
  usableInProposal: integer('usable_in_proposal').default(1),
})

export const opportunities = sqliteTable('opportunities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  platform: text('platform').notNull(),
  sourceJobId: text('source_job_id'),
  url: text('url'),
  body: text('body').notNull(),
  budgetType: text('budget_type'),
  budgetMinYen: integer('budget_min_yen'),
  budgetMaxYen: integer('budget_max_yen'),
  currentStatus: text('current_status').notNull(),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const diagnosisVersions = sqliteTable('diagnosis_versions', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),
  version: integer('version').notNull(),
  recommendation: text('recommendation'),
  recommendationReason: text('recommendation_reason'),
  userDecision: text('user_decision'),
  createdAt: text('created_at').notNull(),
})

export const safetyFindings = sqliteTable('safety_findings', {
  id: text('id').primaryKey(),
  diagnosisVersionId: text('diagnosis_version_id').notNull(),
  ruleId: text('rule_id').notNull(),
  ruleVersion: integer('rule_version').notNull(),
  classification: text('classification').notNull(),
  source: text('source').notNull(),
  quote: text('quote'),
  reason: text('reason').notNull(),
  confidence: text('confidence'),
  status: text('status').notNull(),
  userNote: text('user_note'),
})

export const effortEstimates = sqliteTable('effort_estimates', {
  id: text('id').primaryKey(),
  diagnosisVersionId: text('diagnosis_version_id').notNull(),
  minMinutes: integer('min_minutes').notNull(),
  likelyMinutes: integer('likely_minutes').notNull(),
  maxMinutes: integer('max_minutes').notNull(),
  bufferRate: real('buffer_rate').notNull(),
  bufferReason: text('buffer_reason'),
})

export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(),
  diagnosisVersionId: text('diagnosis_version_id').notNull(),
  strategy: text('strategy').notNull(),
  strategyReason: text('strategy_reason'),
  body: text('body').notNull(),
  usedAchievementIdsJson: text('used_achievement_ids_json'),
  promptVersion: text('prompt_version'),
  createdAt: text('created_at').notNull(),
})

export const pipelineEvents = sqliteTable('pipeline_events', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  reasonCode: text('reason_code'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
})

export const aiRuns = sqliteTable('ai_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  opportunityId: text('opportunity_id'),
  diagnosisVersionId: text('diagnosis_version_id'),
  operation: text('operation').notNull(),
  provider: text('provider').notNull(),
  modelAlias: text('model_alias'),
  modelName: text('model_name'),
  promptVersion: text('prompt_version'),
  schemaVersion: text('schema_version'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costMicrousd: integer('cost_microusd'),
  durationMs: integer('duration_ms'),
  status: text('status').notNull(),
  errorCode: text('error_code'),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: text('created_at').notNull(),
})
