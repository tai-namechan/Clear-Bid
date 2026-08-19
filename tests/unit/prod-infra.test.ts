import { describe, expect, it, vi } from 'vitest'
import { FallbackAiProvider, ResilientAiProvider, type AiProvider } from '../../server/ai/provider'
import { INIT_PROFILE } from '../../shared/types'

describe('ResilientAiProvider', () => {
  it('falls back when primary extract fails', async () => {
    const primary: AiProvider = {
      extract: vi.fn().mockRejectedValue(new Error('boom')),
      estimate: vi.fn(),
      diagnose: vi.fn(),
      generateProposal: vi.fn(),
      assistReply: vi.fn(),
    }
    const provider = new ResilientAiProvider(primary, new FallbackAiProvider())
    const result = await provider.extract({ title: 'Laravel改修', body: 'Laravel で管理画面を改修。予算10万円。' })
    expect(result.requiredSkills.some((s) => s.text === 'Laravel')).toBe(true)
    expect(primary.extract).toHaveBeenCalled()
  })

  it('uses primary proposal when it succeeds', async () => {
    const primary: AiProvider = {
      extract: vi.fn(),
      estimate: vi.fn(),
      diagnose: vi.fn(),
      generateProposal: vi.fn().mockResolvedValue({
        strategy: '課題解決型',
        strategyReason: 'test',
        body: 'primary body',
        usedAchievements: [],
        preQuestions: [],
        assumptions: [],
        scopeIn: [],
        scopeOut: [],
        meetingTopics: [],
      }),
      assistReply: vi.fn(),
    }
    const provider = new ResilientAiProvider(primary, new FallbackAiProvider())
    const result = await provider.generateProposal({
      title: '案件',
      diagnosis: {
        axes: [],
        recommendation: 'apply',
        recommendationReason: 'ok',
        preQuestions: [],
        scopeIn: [],
        scopeOut: [],
      },
      extraction: {
        deliverables: [],
        requiredSkills: [],
        unknowns: [],
      },
      profile: { ...INIT_PROFILE, name: 'テスト' },
    })
    expect(result.body).toBe('primary body')
  })
})

describe('Access config expectations', () => {
  it('documents the required env keys in .env.example', async () => {
    const fs = await import('node:fs/promises')
    const env = await fs.readFile(new URL('../../.env.example', import.meta.url), 'utf8')
    expect(env).toContain('ANTHROPIC_API_KEY')
    expect(env).toContain('CF_ACCESS_TEAM_DOMAIN')
    expect(env).toContain('CF_ACCESS_AUD')
    expect(env).toContain('AUTH_BYPASS')
  })
})
