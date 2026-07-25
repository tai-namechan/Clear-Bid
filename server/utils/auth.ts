import { createRemoteJWKSet, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { users } from '../../db/schema'
import type { AuthUser } from './db'
import { hasDb, useDb } from './db'

export interface AccessClaims {
  email: string
  sub: string
  name?: string
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(teamDomain: string) {
  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`
  let jwks = jwksCache.get(url)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url))
    jwksCache.set(url, jwks)
  }
  return jwks
}

export async function verifyAccessJwt(token: string, teamDomain: string, audience: string): Promise<AccessClaims> {
  const jwks = getJwks(teamDomain)
  const { payload } = await jwtVerify(token, jwks, {
    audience,
    issuer: `https://${teamDomain}.cloudflareaccess.com`,
  })
  const email = String(payload.email || '')
  const sub = String(payload.sub || '')
  if (!email || !sub) throw new Error('Access JWT missing email/sub')
  return {
    email,
    sub,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  }
}

async function upsertUserFromClaims(event: { context: H3EventContext }, claims: AccessClaims): Promise<AuthUser> {
  const db = useDb(event)
  const now = new Date().toISOString()
  const existing = await db.select().from(users).where(eq(users.accessSubject, claims.sub)).limit(1)
  if (existing[0]) {
    const row = existing[0]
    if (row.email !== claims.email || (claims.name && row.displayName !== claims.name)) {
      await db
        .update(users)
        .set({
          email: claims.email,
          displayName: claims.name || row.displayName,
          updatedAt: now,
        })
        .where(eq(users.id, row.id))
    }
    return {
      id: row.id,
      email: claims.email,
      displayName: claims.name || row.displayName,
      accessSubject: claims.sub,
    }
  }

  const byEmail = await db.select().from(users).where(eq(users.email, claims.email)).limit(1)
  if (byEmail[0]) {
    await db
      .update(users)
      .set({
        accessSubject: claims.sub,
        displayName: claims.name || byEmail[0].displayName,
        updatedAt: now,
      })
      .where(eq(users.id, byEmail[0].id))
    return {
      id: byEmail[0].id,
      email: claims.email,
      displayName: claims.name || byEmail[0].displayName,
      accessSubject: claims.sub,
    }
  }

  const id = ulid()
  await db.insert(users).values({
    id,
    email: claims.email,
    displayName: claims.name || null,
    timezone: 'Asia/Tokyo',
    accessSubject: claims.sub,
    createdAt: now,
    updatedAt: now,
  })
  return { id, email: claims.email, displayName: claims.name || null, accessSubject: claims.sub }
}

async function ensureDevUser(event: { context: H3EventContext }, email: string): Promise<AuthUser> {
  if (!hasDb(event)) {
    return { id: 'local-dev-user', email, displayName: 'Local Dev', accessSubject: 'local-dev' }
  }
  const db = useDb(event)
  const now = new Date().toISOString()
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing[0]) {
    return {
      id: existing[0].id,
      email: existing[0].email,
      displayName: existing[0].displayName,
      accessSubject: existing[0].accessSubject,
    }
  }
  const id = ulid()
  await db.insert(users).values({
    id,
    email,
    displayName: 'Local Dev',
    timezone: 'Asia/Tokyo',
    accessSubject: 'local-dev',
    createdAt: now,
    updatedAt: now,
  })
  return { id, email, displayName: 'Local Dev', accessSubject: 'local-dev' }
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export async function resolveAuthUser(event: H3Event): Promise<AuthUser> {
  const config = useRuntimeConfig(event)
  const teamDomain = String(config.cfAccessTeamDomain || '')
  const audience = String(config.cfAccessAud || '')
  const bypass = isTruthyFlag(config.authBypass)
  const token = getHeader(event, 'cf-access-jwt-assertion') || getCookie(event, 'CF_Authorization') || ''

  if (teamDomain && audience && token) {
    const claims = await verifyAccessJwt(token, teamDomain, audience)
    if (!hasDb(event)) {
      return {
        id: `access:${claims.sub}`,
        email: claims.email,
        displayName: claims.name || null,
        accessSubject: claims.sub,
      }
    }
    return upsertUserFromClaims(event, claims)
  }

  if (bypass || !teamDomain || !audience) {
    const email = String(config.devUserEmail || 'dev@local.test')
    return ensureDevUser(event, email)
  }

  throw createError({ statusCode: 401, statusMessage: 'Cloudflare Access authentication required' })
}

export function requireUser(event: H3Event): AuthUser {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return event.context.user
}
