import type { DocumentKey } from '../utils/supabase'
import { useServiceSupabase, useUserSupabase } from '../utils/supabase'

/**
 * Document repository — always scoped by verified userId.
 * Prefer user JWT client (RLS). Fall back to service role with explicit user_id filter.
 */
export async function getDocument<T>(
  userId: string,
  key: DocumentKey,
  accessToken?: string,
): Promise<T | null> {
  const client = accessToken ? useUserSupabase(accessToken) : useServiceSupabase()
  const { data, error } = await client
    .from('user_documents')
    .select('json')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return (data?.json as T) ?? null
}

export async function putDocument(
  userId: string,
  key: DocumentKey,
  value: unknown,
  accessToken?: string,
): Promise<void> {
  const client = accessToken ? useUserSupabase(accessToken) : useServiceSupabase()
  const { error } = await client.from('user_documents').upsert(
    {
      user_id: userId,
      key,
      json: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,key' },
  )
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
}

export async function getAllDocuments(userId: string, accessToken?: string) {
  const client = accessToken ? useUserSupabase(accessToken) : useServiceSupabase()
  const { data, error } = await client.from('user_documents').select('key, json').eq('user_id', userId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const out: Partial<Record<DocumentKey, unknown>> = {}
  for (const row of data || []) {
    out[row.key as DocumentKey] = row.json
  }
  return out
}
