import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

describe('Supabase RLS migration SQL', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(join(dir, '../../supabase/migrations/20260812_user_documents_rls.sql'), 'utf8')

  it('enables RLS and scopes by auth.uid()', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('auth.uid() = user_id')
    expect(sql).toContain("key in ('profile', 'pipeline', 'stats', 'ai_usage')")
  })
})

describe('env example for Supabase', () => {
  it('documents required Supabase keys', async () => {
    const fs = await import('node:fs/promises')
    const env = await fs.readFile(new URL('../../.env.example', import.meta.url), 'utf8')
    expect(env).toContain('NUXT_PUBLIC_SUPABASE_URL')
    expect(env).toContain('NUXT_PUBLIC_SUPABASE_ANON_KEY')
    expect(env).toContain('NUXT_SUPABASE_SERVICE_ROLE_KEY')
    expect(env).toContain('ANTHROPIC_API_KEY')
    expect(env).not.toContain('CF_ACCESS_TEAM_DOMAIN')
  })
})
