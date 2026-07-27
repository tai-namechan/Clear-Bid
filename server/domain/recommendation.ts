import type {
  DiagnosisResult,
  EffortEstimate,
  ExtractionResult,
  SafetyFinding,
} from '../../shared/schemas/ai'
import type { EngagementType, RequirementEvidence, UserProfile } from '../../shared/types'
import {
  availableMonthlyHours,
  hasBlockingEvidenceGaps,
  hasUnsupportedRequirement,
  isOngoingEngagement,
  parseHoursField,
  safeMonthlyEffectiveHourly,
} from '../../shared/domain/flexy'
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
  /** 月額上限（上限のみの場合は安全側時給に使わない） */
  budgetMaxYen?: number | null
  feeRatePercent: number
  deadlineDays?: number | null
  applicants?: number | null
  engagementType?: EngagementType
  budgetType?: string
  expectedMonthlyHoursMin?: string | null
  expectedMonthlyHoursMax?: string | null
  requirementEvidences?: RequirementEvidence[]
}

export function decideRecommendation(input: RecommendationInput): {
  recommendation: DiagnosisResult['recommendation']
  reason: string
  takeHome: number | null
  safeHourly: number | null
  likelyHourly: number | null
  availableHours: number | null
  totals: { min: number; likely: number; max: number }
  consultantQuestions: string[]
  selfCheckQuestions: string[]
} {
  const ongoing = isOngoingEngagement(input.engagementType, input.budgetType)
  const evidences = input.requirementEvidences || []
  const selfCheckQuestions: string[] = []
  const consultantQuestions: string[] = []

  if (ongoing) {
    return decideOngoingRecommendation(input, evidences, selfCheckQuestions, consultantQuestions)
  }

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

  const base = {
    takeHome,
    safeHourly,
    likelyHourly,
    availableHours,
    totals: { min: totals.min, likely: likelyWithBuffer, max: maxWithBuffer },
    consultantQuestions,
    selfCheckQuestions,
  }

  if (blocks.length > 0) {
    return {
      recommendation: 'skip',
      reason: `未解除のBLOCK（${blocks.map((b) => b.ruleId).join(', ')}）があるため、見送り候補です。`,
      ...base,
    }
  }

  if (ngHit) {
    return {
      recommendation: 'skip',
      reason: '登録したNG条件に一致するリスクがあります。',
      ...base,
    }
  }

  if (availableHours != null && maxWithBuffer > availableHours * 1.3) {
    return {
      recommendation: 'skip',
      reason: `最大工数（${maxWithBuffer}h）が利用可能時間（${availableHours}h）を大幅に超えています。`,
      ...base,
    }
  }

  if (safeHourly != null && safeHourly < input.profile.minHourlyYen * 0.6) {
    return {
      recommendation: 'skip',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望時給（¥${input.profile.minHourlyYen}）を大幅に下回ります。`,
      ...base,
    }
  }

  if (checks.length > 0 || budgetUnknown || scopeUnknown) {
    return {
      recommendation: 'question',
      reason: '重要な確認事項または不足情報があるため、質問してから判断するのが安全です。',
      ...base,
    }
  }

  if (availableHours != null && maxWithBuffer > availableHours) {
    return {
      recommendation: 'question',
      reason: '最大工数では完遂が厳しいため、スコープや納期の調整余地を確認してください。',
      ...base,
    }
  }

  if (safeHourly != null && safeHourly < input.profile.minHourlyYen) {
    return {
      recommendation: 'question',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望を下回ります。条件確認後に判断してください。`,
      ...base,
    }
  }

  return {
    recommendation: 'apply',
    reason: '未解除BLOCKはなく、必須情報と採算・稼働の条件を満たしています。',
    ...base,
  }
}

function decideOngoingRecommendation(
  input: RecommendationInput,
  evidences: RequirementEvidence[],
  selfCheckQuestions: string[],
  consultantQuestions: string[],
): ReturnType<typeof decideRecommendation> {
  const open = input.safety.filter((s) => s.status === 'open')
  const blocks = open.filter((s) => s.classification === 'BLOCK')
  const checks = open.filter((s) => s.classification === 'CHECK')

  const monthlyAvail = availableMonthlyHours(input.profile.weeklyHours)
  const hoursMin = parseHoursField(input.expectedMonthlyHoursMin)
  const hoursMax = parseHoursField(input.expectedMonthlyHoursMax)

  // 週N日だけでは月間時間を決めない
  if (hoursMin == null && hoursMax == null) {
    consultantQuestions.push('想定月間稼働時間（時間）を教えてください')
  }
  if (input.budgetMinYen == null && (input.budgetMaxYen != null || input.budgetMinYen == null)) {
    if (input.budgetMinYen == null) {
      consultantQuestions.push('月額報酬の下限を確認してください')
    }
  }
  if (input.extraction?.requiredAvailability?.provenance !== 'confirmed') {
    consultantQuestions.push('日中MTG・レスポンス要件・対応時間帯を確認してください')
  } else if (/ビジネスタイム以外|空き時間/.test(input.extraction.requiredAvailability.text)) {
    consultantQuestions.push('日中MTGの要否と、ビジネスタイム外稼働で足りるか確認してください')
  }

  for (const e of evidences) {
    if (e.status === 'unverified' || e.status === 'partial') {
      selfCheckQuestions.push(`必須要件「${e.requirement}」の経験有無・根拠を確認してください`)
    }
  }

  const safeHourly = safeMonthlyEffectiveHourly({
    budgetMinYen: input.budgetMinYen,
    monthlyHoursMax: hoursMax ?? hoursMin,
    feeRatePercent: input.feeRatePercent,
  })
  // 上限のみでは takeHome も確定表示しない（下限契約額がないため）
  const takeHome =
    input.budgetMinYen != null
      ? preTaxTakeHome({
          contractYen: input.budgetMinYen,
          feeRatePercent: input.feeRatePercent,
        })
      : null

  const likelyHourly =
    takeHome != null && hoursMin != null && hoursMin > 0
      ? Math.round(takeHome / hoursMin)
      : null

  const totals = {
    min: hoursMin ?? 0,
    likely: hoursMin ?? hoursMax ?? 0,
    max: hoursMax ?? hoursMin ?? 0,
  }

  const base = {
    takeHome,
    safeHourly,
    likelyHourly,
    availableHours: monthlyAvail,
    totals,
    consultantQuestions,
    selfCheckQuestions,
  }

  if (blocks.length > 0) {
    return {
      recommendation: 'skip',
      reason: `未解除のBLOCK（${blocks.map((b) => b.ruleId).join(', ')}）があるため、見送り候補です。`,
      ...base,
    }
  }

  if (hasUnsupportedRequirement(evidences)) {
    return {
      recommendation: 'skip',
      reason: '必須要件に経験なし（unsupported）があるため、見送り候補です。',
      ...base,
    }
  }

  if (hoursMin != null && hoursMin > monthlyAvail * 1.3) {
    return {
      recommendation: 'skip',
      reason: `案件の月間最低時間（${hoursMin}h）が利用可能月間時間（${monthlyAvail}h）を30%以上超えています。`,
      ...base,
    }
  }

  if (safeHourly != null && safeHourly < input.profile.minHourlyYen * 0.6) {
    return {
      recommendation: 'skip',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望時給（¥${input.profile.minHourlyYen}）を大幅に下回ります。`,
      ...base,
    }
  }

  if (hasBlockingEvidenceGaps(evidences)) {
    return {
      recommendation: 'question',
      reason: '必須要件に未確認または部分一致が残っているため、本人確認してから判断してください。',
      ...base,
    }
  }

  if (hoursMin == null && hoursMax == null) {
    return {
      recommendation: 'question',
      reason: '想定月間稼働時間が未入力のため、完遂可能性を判定できません。確認してから判断してください。',
      ...base,
    }
  }

  if (hoursMin != null && hoursMin > monthlyAvail) {
    return {
      recommendation: 'question',
      reason: `案件の月間最低時間（${hoursMin}h）が利用可能月間時間（${monthlyAvail}h）を超えます。調整余地を確認してください。`,
      ...base,
    }
  }

  if (checks.length > 0 || consultantQuestions.length > 0) {
    return {
      recommendation: 'question',
      reason: 'FLEXY担当者への確認事項または不足情報があるため、質問してから判断するのが安全です。',
      ...base,
    }
  }

  if (safeHourly == null) {
    return {
      recommendation: 'question',
      reason: '月額下限と月間時間が揃っていないため、安全側実質時給を確定できません。',
      ...base,
    }
  }

  if (safeHourly < input.profile.minHourlyYen) {
    return {
      recommendation: 'question',
      reason: `安全側実質時給（¥${safeHourly}）が最低希望を下回ります。条件確認後に判断してください。`,
      ...base,
    }
  }

  return {
    recommendation: 'apply',
    reason: '必須要件は確認済みで、月間稼働・採算の条件を満たしています。',
    ...base,
  }
}

export function buildAxes(input: RecommendationInput & {
  decision: ReturnType<typeof decideRecommendation>
}): DiagnosisResult['axes'] {
  const { decision, safety, profile, extraction, applicants } = input
  const ongoing = isOngoingEngagement(input.engagementType, input.budgetType)
  const openBlocks = safety.filter((s) => s.status === 'open' && s.classification === 'BLOCK')
  const openChecks = safety.filter((s) => s.status === 'open' && s.classification === 'CHECK')
  const evidences = input.requirementEvidences || []

  const skillNames = new Set(profile.skills.map((s) => s.name.toLowerCase()))
  const requiredFromExt =
    extraction?.requiredRequirements?.length
      ? extraction.requiredRequirements.map((s) => s.text)
      : extraction?.requiredSkills?.map((s) => s.text) || []
  const required = requiredFromExt
  const matched = evidences.length
    ? evidences.filter((e) => e.status === 'supported').map((e) => e.requirement)
    : required.filter((r) =>
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
        : evidences.some((e) => e.status === 'unsupported')
          ? 'check'
          : evidences.length && evidences.every((e) => e.status === 'supported')
            ? 'good'
            : matched.length > 0 || evidences.some((e) => e.status === 'partial')
              ? 'attention'
              : 'check',
      facts: [
        `必須要件 ${required.length || 0} / 根拠あり ${evidences.filter((e) => e.status === 'supported').length || matched.length}`,
        `登録スキル ${profile.skills.length}`,
      ],
      reason:
        required.length === 0
          ? '必須要件が抽出できていません'
          : evidences.some((e) => e.status === 'unverified')
            ? '必須要件の本人確認が未完了です'
            : matched.length
              ? '一部または全部の必須要件に対応できます'
              : '必須要件との一致が確認できません',
      missing: evidences
        .filter((e) => e.status === 'unverified' || e.status === 'partial' || e.status === 'unsupported')
        .map((e) => e.requirement)
        .slice(0, 5),
    },
    {
      axis: 'feasibility',
      rating: ongoing
        ? decision.availableHours == null
          ? 'unknown'
          : parseHoursField(input.expectedMonthlyHoursMin) == null &&
              parseHoursField(input.expectedMonthlyHoursMax) == null
            ? 'unknown'
            : decision.totals.min > 0 && decision.totals.min <= (decision.availableHours || 0)
              ? 'good'
              : decision.totals.min <= (decision.availableHours || 0) * 1.3
                ? 'attention'
                : 'check'
        : decision.availableHours == null
          ? 'unknown'
          : decision.totals.max <= decision.availableHours
            ? 'good'
            : decision.totals.max <= decision.availableHours * 1.3
              ? 'attention'
              : 'check',
      facts: ongoing
        ? [
            decision.totals.min || decision.totals.max
              ? `想定月間 ${decision.totals.min || '—'}〜${decision.totals.max || '—'}h`
              : '想定月間時間 未入力',
            decision.availableHours != null
              ? `利用可能月間時間 ${decision.availableHours}h`
              : '利用可能時間 判定不能',
            '週稼働日数から月間時間は自動換算していません',
          ]
        : [
            `標準 ${decision.totals.likely}h / 最大 ${decision.totals.max}h`,
            decision.availableHours != null
              ? `利用可能時間 ${decision.availableHours}h`
              : '納期未設定のため利用可能時間は判定不能',
          ],
      reason: ongoing
        ? parseHoursField(input.expectedMonthlyHoursMin) == null &&
          parseHoursField(input.expectedMonthlyHoursMax) == null
          ? '月間稼働時間が不明なため完遂可能性を確定できません'
          : decision.totals.min <= (decision.availableHours || 0)
            ? '想定月間時間は利用可能時間内です'
            : '想定月間時間が利用可能時間を超える可能性があります'
        : decision.availableHours == null
          ? '納期情報がないため完遂可能性を確定できません'
          : decision.totals.max <= decision.availableHours
            ? '最大工数でも稼働内に収まります'
            : '最大工数が利用可能時間を超える可能性があります',
      missing: ongoing
        ? parseHoursField(input.expectedMonthlyHoursMin) == null &&
          parseHoursField(input.expectedMonthlyHoursMax) == null
          ? ['想定月間稼働時間']
          : []
        : decision.availableHours == null
          ? ['希望納期']
          : [],
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
        decision.takeHome != null
          ? `税引前手取り見込み（下限ベース） ¥${decision.takeHome.toLocaleString()}`
          : ongoing
            ? '月額下限未設定のため手取り未確定'
            : '予算未設定',
        decision.safeHourly != null
          ? `安全側実質時給 ¥${decision.safeHourly}`
          : '安全側実質時給は算出不能（下限×月間時間が必要）',
        decision.likelyHourly != null ? `参考実質時給 ¥${decision.likelyHourly}` : '',
      ].filter(Boolean),
      reason:
        decision.safeHourly == null
          ? ongoing
            ? '月額下限と月間時間がないため採算性を確定できません'
            : '予算が不明なため採算性を判定できません'
          : decision.safeHourly >= profile.minHourlyYen
            ? '安全側でも最低希望時給を満たします'
            : '安全側実質時給が最低希望を下回ります',
      missing: decision.safeHourly == null
        ? ongoing
          ? ['月額下限', '想定月間稼働時間']
          : ['予算下限']
        : [],
    },
    {
      axis: 'winChance',
      rating:
        applicants == null
          ? ongoing
            ? 'unknown'
            : 'unknown'
          : applicants <= 5
            ? 'good'
            : applicants <= 15
              ? 'attention'
              : 'check',
      facts: [
        applicants != null ? `応募人数 ${applicants}` : ongoing ? '紹介案件のため応募人数は参考外' : '応募人数不明',
        `提案利用可能実績 ${profile.achievements.filter((a) => a.usableInProposal !== false).length}`,
      ],
      reason:
        profile.achievements.length === 0
          ? '差別化に使える実績が未登録です'
          : applicants != null && applicants > 15
            ? '競争が激しい可能性があります'
            : '実績を使った差別化が可能です',
      missing: applicants == null && !ongoing ? ['現在の応募人数'] : [],
    },
  ]
}
