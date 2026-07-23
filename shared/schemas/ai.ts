import { z } from 'zod'

export const ProvenanceSchema = z.enum(['confirmed', 'inferred', 'unknown'])

export const ExtractedItemSchema = z.object({
  text: z.string(),
  provenance: ProvenanceSchema,
  quote: z.string().optional().default(''),
})

export const ExtractionResultSchema = z.object({
  deliverables: z.array(ExtractedItemSchema).default([]),
  requiredSkills: z.array(ExtractedItemSchema).default([]),
  budget: ExtractedItemSchema.optional(),
  deadline: ExtractedItemSchema.optional(),
  mtgConditions: ExtractedItemSchema.optional(),
  maintenance: ExtractedItemSchema.optional(),
  revisionTerms: ExtractedItemSchema.optional(),
  selectionCriteria: ExtractedItemSchema.optional(),
  unknowns: z.array(z.string()).default([]),
})

export const SafetyFindingSchema = z.object({
  ruleId: z.string(),
  ruleVersion: z.number().default(1),
  classification: z.enum(['BLOCK', 'CHECK', 'INFO']),
  source: z.enum(['rule', 'ai']).default('rule'),
  quote: z.string().nullable().default(null),
  reason: z.string(),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  status: z.enum(['open', 'resolved']).default('open'),
  userNote: z.string().nullable().default(null),
  resolveReason: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
})

export const EffortTaskSchema = z.object({
  category: z.string(),
  min: z.number().nonnegative(),
  likely: z.number().nonnegative(),
  max: z.number().nonnegative(),
  assumption: z.string().default(''),
})

export const EffortEstimateSchema = z.object({
  tasks: z.array(EffortTaskSchema),
  bufferRate: z.number().min(0).max(1).default(0.2),
  bufferReason: z.string().default(''),
})

export const AxisAssessmentSchema = z.object({
  axis: z.enum(['safety', 'fitness', 'feasibility', 'profitability', 'winChance']),
  rating: z.enum(['good', 'attention', 'check', 'unknown']),
  facts: z.array(z.string()).default([]),
  reason: z.string(),
  missing: z.array(z.string()).default([]),
  improvements: z.array(z.string()).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
})

export const DiagnosisResultSchema = z.object({
  axes: z.array(AxisAssessmentSchema),
  recommendation: z.enum(['apply', 'question', 'skip']),
  recommendationReason: z.string(),
  clientIntent: z
    .object({
      underlyingProblem: z.string(),
      selectionPriority: z.string(),
      concerns: z.string(),
      evidenceNeeded: z.string().optional(),
    })
    .optional(),
  preQuestions: z.array(z.string()).default([]),
  scopeIn: z.array(z.string()).default([]),
  scopeOut: z.array(z.string()).default([]),
})

export const ProposalResultSchema = z.object({
  strategy: z.string(),
  strategyReason: z.string(),
  body: z.string(),
  usedAchievements: z.array(z.string()).default([]),
  preQuestions: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  scopeIn: z.array(z.string()).default([]),
  scopeOut: z.array(z.string()).default([]),
  meetingTopics: z.array(z.string()).default([]),
})

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>
export type SafetyFinding = z.infer<typeof SafetyFindingSchema>
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>
export type EffortTask = z.infer<typeof EffortTaskSchema>
export type AxisAssessment = z.infer<typeof AxisAssessmentSchema>
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>
export type ProposalResult = z.infer<typeof ProposalResultSchema>
