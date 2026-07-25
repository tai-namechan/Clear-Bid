import { and, eq } from 'drizzle-orm'
import { userDocuments } from '../../db/schema'
import type { AppDb } from '../utils/db'

export type DocumentKey = 'profile' | 'pipeline' | 'stats' | 'ai_usage'

export async function getDocument<T>(db: AppDb, userId: string, key: DocumentKey): Promise<T | null> {
  const rows = await db
    .select()
    .from(userDocuments)
    .where(and(eq(userDocuments.userId, userId), eq(userDocuments.key, key)))
    .limit(1)
  if (!rows[0]) return null
  try {
    return JSON.parse(rows[0].json) as T
  } catch {
    return null
  }
}

export async function putDocument(db: AppDb, userId: string, key: DocumentKey, value: unknown): Promise<void> {
  const now = new Date().toISOString()
  const json = JSON.stringify(value)
  const existing = await db
    .select()
    .from(userDocuments)
    .where(and(eq(userDocuments.userId, userId), eq(userDocuments.key, key)))
    .limit(1)
  if (existing[0]) {
    await db
      .update(userDocuments)
      .set({ json, updatedAt: now })
      .where(and(eq(userDocuments.userId, userId), eq(userDocuments.key, key)))
  } else {
    await db.insert(userDocuments).values({
      userId,
      key,
      json,
      updatedAt: now,
    })
  }
}

export async function getAllDocuments(db: AppDb, userId: string) {
  const rows = await db.select().from(userDocuments).where(eq(userDocuments.userId, userId))
  const out: Partial<Record<DocumentKey, unknown>> = {}
  for (const row of rows) {
    try {
      out[row.key as DocumentKey] = JSON.parse(row.json)
    } catch {
      /* skip */
    }
  }
  return out
}
