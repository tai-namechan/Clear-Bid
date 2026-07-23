import type {
  DiagnosisResult,
  EffortEstimate,
  ExtractionResult,
  SafetyFinding,
} from '../../shared/schemas/ai'
import type { UserProfile } from '../../shared/types'
import {
  availableHoursUntilDeadline,
  effectiveHourlyYen,
  preTaxTakeHome,
  sumEffortHours,
} from './money'

export interface RecommendationInput {
  safety: SafetyFinding[]
  effort: EffortEstimate
  extraction: ExtractionResult | null
  profile: UserProfile
  budgetMinYen: number | null
  feeRatePercent: number
  deadlineDays?: number | null
  applicants?: number | null
}

export function decideRecommendation(input: RecommendationInput): {
  recommendation: DiagnosisResult['recommendation']
  reason: string
  takeHome: number | null
  safeHourly: number | null
  likelyHourly: number | null
  availableHours: number | null
  totals: { min: number; likely: number; max: number }
} {
  const open = input.safety.filter((s) => s.status === 'open')
  const blocks = open.filter((s) => s.classification === 'BLOCK')
  const checks = open.filter((s) => s.classification === 'CHECK')
  const infos = open.filter((s) => s.classification === 'INFO')
  const totals = sumEffortHours(input.effort.tasks)
  const maxWithBuffer =
    Math.round(totals.max * (1 + (input.effort.bufferRate || 0)) * 10) / 10
  const likelyWithBuffer =
    Math.round(totals.likely * (1 + (input.effort.bufferRate || 0)) * 10) / 10

  const availableHours = availableHoursUntilDeadline({
    weeklyHours: input.profile.weeklyHours,
    deadlineDays: input.deadlineDays,
  })

  const takeHome =
    input.budgetMinYen != null
      ? preTaxTakeHome({
          contractYen: input.budgetMinYen,
          feeRatePercent: input.feeRatePercent,
        })
      : null
  const safeHourly =
    takeHome != null ? effectiveHourlyYen(takeHome, maxWithBuffer) : null
  const likelyHourly =
    takeHome != null ? effectiveHourlyYen(takeHome, likelyWithBuffer) : null

  const ngHit = open.some((f) =>
    input.profile.ngConditions.some((ng) => f.reason.includes(ng) || (f.quote || '').includes(ng)),
  )

  const budgetUnknown =
    !input.budgetMinYen ||
    input.extraction?.budget?.provenance === 'unknown' ||
    infos.some((i) => i.ruleId === 'BUD-01')

  const scopeUnknown =
    (input.extraction?.unknowns?.length || 0) > 0 ||
    checks.some((c) => c.ruleId.startsWith('SCP-'))

  if (blocks.length > 0) {
    return {
      recommendation: 'skip',
      reason: `未解除のBLOCK（${blocks.map((b) => b.ruleId).join(', ')}）があるため、見送り候補です。`,
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (ngHit) {
    return {
      recommendation: 'skip',
      reason: '登録したNG条件に一致するリスクがあります。',
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (
    availableHours != null &&
    maxWithBuffer > availableHours * 1.3
  ) {
    return {
      recommendation: 'skip',
      reason: `最大工数（${maxWithBuffer}h）が利用可能時間（${availableHours}h）を大幅に超えています。`,
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (
    safeHourly != null &&
    safeHourly < input.profile.minHourlyYen * 0.6
  ) {
    return {
      recommendation: 'skip',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望時給（¥${input.profile.minHourlyYen}）を大幅に下回ります。`,
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (checks.length > 0 || budgetUnknown || scopeUnknown) {
    return {
      recommendation: 'question',
      reason: '重要な確認事項または不足情報があるため、質問してから判断するのが安全です。',
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (
    availableHours != null &&
    maxWithBuffer > availableHours
  ) {
    return {
      recommendation: 'question',
      reason: '最大工数では完遂が厳しいため、スコープや納期の調整余地を確認してください。',
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  if (safeHourly != null && safeHourly < input.profile.minHourlyYen) {
    return {
      recommendation: 'question',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望を下回ります。条件確認後に判断してください。`,
      takeHome,
      safeHourly,
      likelyHourly,
      availableHours,
      totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    }
  }

  return {
    recommendation: 'apply',
    reason: '未解除BLOCKはなく、必須情報と採算・稼働の条件を満たしています。',
    takeHome,
    safeHourly,
    likelyHourly,
    availableHours,
    totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
  }
}

export function buildAxes(input: RecommendationInput & {
  decision: ReturnType<typeof decideRecommendation>
}): DiagnosisResult['axes'] {
  const { decision, safety, profile, extraction, applicants } = input
  const openBlocks = safety.filter((s) => s.status === 'open' && s.classification === 'BLOCK')
  const openChecks = safety.filter((s) => s.status === 'open' && s.classification === 'CHECK')

  const skillNames = new Set(profile.skills.map((s) => s.name.toLowerCase()))
  const required = extraction?.requiredSkills?.map((s) => s.text) || []
  const matched = required.filter((r) =>
    [...skillNames].some((sk) => r.toLowerCase().includes(sk) || sk.includes(r.toLowerCase())),
  )

  return [
    {
      axis: 'safety',
      rating: openBlocks.length
        ? 'check'
        : openChecks.length
          ? 'attention'
          : safety.some((s) => s.ruleId === 'CLT-04')
            ? 'unknown'
            : 'good',
      facts: [
        `BLOCK ${openBlocks.length}件 / CHECK ${openChecks.length}件`,
        ...openBlocks.slice(0, 2).map((b) => b.reason),
      ],
      reason: openBlocks.length
        ? '未解除の危険信号があります'
        : openChecks.length
          ? '確認すべき契約・スコープ項目があります'
          : '明確な危険信号は検出されていません',
      missing: safety.filter((s) => s.classification === 'INFO').map((s) => s.reason).slice(0, 3),
    },
    {
      axis: 'fitness',
      rating: required.length === 0
        ? 'unknown'
        : matched.length === required.length
          ? 'good'
          : matched.length > 0
            ? 'attention'
            : 'check',
      facts: [
        `必須スキル ${required.length || 0} / 一致 ${matched.length}`,
        `登録スキル ${profile.skills.length}`,
      ],
      reason:
        required.length === 0
          ? '必須スキルが抽出できていません'
          : matched.length
            ? '一部または全部の必須スキルに対応できます'
            : '必須スキルとの一致が確認できません',
      missing: required.filter((r) => !matched.includes(r)),
    },
    {
      axis: 'feasibility',
      rating:
        decision.availableHours == null
          ? 'unknown'
          : decision.totals.max <= decision.availableHours
            ? 'good'
            : decision.totals.max <= decision.availableHours * 1.3
              ? 'attention'
              : 'check',
      facts: [
        `標準 ${decision.totals.likely}h / 最大 ${decision.totals.max}h`,
        decision.availableHours != null
          ? `利用可能時間 ${decision.availableHours}h`
          : '納期未設定のため利用可能時間は判定不能',
      ],
      reason:
        decision.availableHours == null
          ? '納期情報がないため完遂可能性を確定できません'
          : decision.totals.max <= decision.availableHours
            ? '最大工数でも稼働内に収まります'
            : '最大工数が利用可能時間を超える可能性があります',
      missing: decision.availableHours == null ? ['希望納期'] : [],
    },
    {
      axis: 'profitability',
      rating:
        decision.safeHourly == null
          ? 'unknown'
          : decision.safeHourly >= profile.minHourlyYen
            ? 'good'
            : decision.safeHourly >= profile.minHourlyYen * 0.8
              ? 'attention'
              : 'check',
      facts: [
        decision.takeHome != null ? `税引前手取り見込み ¥${decision.takeHome.toLocaleString()}` : '予算未設定',
        decision.safeHourly != null ? `安全側実質時給 ¥${decision.safeHourly}` : '時給算出不能',
        decision.likelyHourly != null ? `標準実質時給 ¥${decision.likelyHourly}` : '',
      ].filter(Boolean),
      reason:
        decision.safeHourly == null
          ? '予算が不明なため採算性を判定できません'
          : decision.safeHourly >= profile.minHourlyYen
            ? '安全側でも最低希望時給を満たします'
            : '安全側実質時給が最低希望を下回ります',
      missing: decision.safeHourly == null ? ['予算下限'] : [],
    },
    {
      axis: 'winChance',
      rating:
        applicants == null
          ? 'unknown'
          : applicants <= 5
            ? 'good'
            : applicants <= 15
              ? 'attention'
              : 'check',
      facts: [
        applicants != null ? `応募人数 ${applicants}` : '応募人数不明',
        `提案利用可能実績 ${profile.achievements.filter((a) => a.usableInProposal !== false).length}`,
      ],
      reason:
        profile.achievements.length === 0
          ? '差別化に使える実績が未登録です'
          : applicants != null && applicants > 15
            ? '競争が激しい可能性があります'
            : '実績を使った差別化が可能です',
      missing: applicants == null ? ['現在の応募人数'] : [],
    },
  ]
}
