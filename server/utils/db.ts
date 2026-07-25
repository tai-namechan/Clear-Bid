import type { D1Database } from '@cloudflare/workers-types'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema'

export type AppDb = DrizzleD1Database<typeof schema>

export interface AuthUser {
  id: string
  email: string
  displayName?: string | null
  accessSubject?: string | null
}

declare module 'h3' {
  interface H3EventContext {
    cloudflare?: {
      env?: {
        DB?: D1Database
      }
    }
    db?: AppDb
    user?: AuthUser
  }
}

export function getD1(event: { context: H3EventContext }): D1Database | null {
  return event.context.cloudflare?.env?.DB || null
}

export function useDb(event: { context: H3EventContext }): AppDb {
  if (event.context.db) return event.context.db
  const d1 = getD1(event)
  if (!d1) {
    throw createError({ statusCode: 503, statusMessage: 'D1 database is not bound' })
  }
  const db = drizzle(d1, { schema })
  event.context.db = db
  return db
}

export function hasDb(event: { context: H3EventContext }): boolean {
  return Boolean(getD1(event))
}
