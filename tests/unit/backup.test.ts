import { describe, expect, it } from 'vitest'

describe('backup shape', () => {
  it('accepts a minimal portable backup payload', () => {
    const backup = {
      version: 1,
      exportedAt: '2026-07-27T00:00:00.000Z',
      app: 'clear-bid',
      profile: { name: 'テスト', skills: [], achievements: [], ngConditions: [] },
      pipeline: [{ id: '1', title: '案件A', platform: 'crowdworks', status: 'review', date: '2026-07-01' }],
      stats: { diagnosed: 1 },
      ai_usage: { period: '2026-07', counts: {}, failedCounts: {} },
      draft_input: null,
    }
    expect(backup.version).toBe(1)
    expect(backup.pipeline).toHaveLength(1)
    expect(backup.profile.name).toBe('テスト')
  })
})
