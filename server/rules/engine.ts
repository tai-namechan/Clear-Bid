import type { SafetyFinding } from '../../shared/schemas/ai'
import { SAFETY_RULES } from './catalog'

function findQuote(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  if (!match || match.index == null) return null
  const start = Math.max(0, match.index - 8)
  const end = Math.min(text.length, match.index + match[0].length + 8)
  return text.slice(start, end).trim()
}

export function runSafetyRules(input: {
  title: string
  body: string
  budgetMin?: string
  clientRating?: string
  clientOrders?: string
}): SafetyFinding[] {
  const text = `${input.title}\n${input.body}`
  const findings: SafetyFinding[] = []
  const seen = new Set<string>()

  for (const rule of SAFETY_RULES) {
    if (rule.id === 'SCP-01') {
      if (input.body.trim().length > 0 && input.body.trim().length < 80) {
        findings.push({
          ruleId: rule.id,
          ruleVersion: rule.version,
          classification: rule.classification,
          source: 'rule',
          quote: null,
          reason: rule.reason,
          confidence: 'medium',
          status: 'open',
          userNote: null,
        })
      }
      continue
    }

    if (rule.id === 'BUD-01' && (!input.budgetMin || input.budgetMin === '0')) {
      const hasBudgetPhrase = /円|予算|報酬|単価/.test(text)
      if (!hasBudgetPhrase || rule.patterns.some((p) => p.test(text))) {
        findings.push({
          ruleId: rule.id,
          ruleVersion: rule.version,
          classification: 'INFO',
          source: 'rule',
          quote: null,
          reason: rule.reason,
          confidence: 'high',
          status: 'open',
          userNote: null,
        })
      }
      continue
    }

    for (const pattern of rule.patterns) {
      if (!pattern.test(text)) continue
      const quote = findQuote(text, pattern)
      if (rule.requiresQuote && (!quote || !text.includes(quote.replace(/\s+/g, ' ').slice(0, 10)))) {
        // Spec: do not save findings whose quote is not in the source text
        if (!quote || !text.includes(quote)) continue
      }
      if (seen.has(rule.id)) break
      seen.add(rule.id)
      findings.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        classification: rule.classification,
        source: 'rule',
        quote,
        reason: rule.reason,
        confidence: 'high',
        status: 'open',
        userNote: null,
      })
      break
    }
  }

  // CLT-01 / CLT-04 style client info
  const hasClient =
    Boolean(input.clientRating) || Boolean(input.clientOrders)
  if (!hasClient) {
    findings.push({
      ruleId: 'CLT-04',
      ruleVersion: 1,
      classification: 'INFO',
      source: 'rule',
      quote: null,
      reason: '発注者情報が未入力です。判定不能として扱います',
      confidence: 'high',
      status: 'open',
      userNote: null,
    })
  } else if (!input.clientOrders || Number(input.clientOrders) === 0) {
    findings.push({
      ruleId: 'CLT-01',
      ruleVersion: 1,
      classification: 'INFO',
      source: 'rule',
      quote: null,
      reason: '評価・発注実績が少ない可能性があります。本人確認と仮払いを確認してください',
      confidence: 'medium',
      status: 'open',
      userNote: null,
    })
  }

  const order = { BLOCK: 0, CHECK: 1, INFO: 2 } as const
  return findings.sort((a, b) => order[a.classification] - order[b.classification])
}
