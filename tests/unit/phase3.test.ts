import { describe, expect, it } from 'vitest'
import { canUse, emptyUsage, recordFailure, recordSuccess } from '../../shared/domain/usage'
import { AI_USAGE_LIMITS } from '../../shared/constants'
import { PROPOSAL_STRATEGIES, ReplyAssistSchema } from '../../shared/schemas/ai'
import { getAiProvider } from '../../server/ai/provider'
import { INIT_PROFILE } from '../../shared/types'

describe('AI usage soft gate', () => {
  it('allows use under the limit', () => {
    const usage = emptyUsage()
    expect(canUse(usage, 'proposal', AI_USAGE_LIMITS.proposal)).toBe(true)
  })

  it('blocks when count reaches the limit', () => {
    let usage = emptyUsage()
    for (let i = 0; i < AI_USAGE_LIMITS.reply; i++) {
      usage = recordSuccess(usage, 'reply')
    }
    expect(canUse(usage, 'reply', AI_USAGE_LIMITS.reply)).toBe(false)
  })

  it('tracks failures separately from successes', () => {
    let usage = emptyUsage()
    usage = recordSuccess(usage, 'extract')
    usage = recordFailure(usage, 'extract')
    expect(usage.counts.extract).toBe(1)
    expect(usage.failedCounts.extract).toBe(1)
    expect(canUse(usage, 'extract', AI_USAGE_LIMITS.extract)).toBe(true)
  })
})

describe('proposal strategies', () => {
  it('exposes the three MVP strategies', () => {
    expect(PROPOSAL_STRATEGIES).toEqual(['課題解決型', '実績・証拠型', '進め方明確型'])
  })
})

describe('reply assist fallback', () => {
  it('returns a schema-valid draft reply', async () => {
    const provider = getAiProvider()
    const result = await provider.assistReply({
      title: 'Laravel改修',
      replyBody: '納期は来月末でお願いします。予算は10万円です。追加の管理画面も必要ですか？',
      profile: { ...INIT_PROFILE, name: '佐藤' },
    })
    const parsed = ReplyAssistSchema.safeParse(result)
    expect(parsed.success).toBe(true)
    expect(result.draftReply).toContain('佐藤')
    expect(result.needsReestimate).toBe(true)
    expect(result.conditionChanges.length).toBeGreaterThan(0)
  })
})
