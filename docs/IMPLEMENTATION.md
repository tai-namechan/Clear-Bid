# Implementation status

Based on Clear Bid MVP Spec v1.0.

## Done in this PR

### Phase 0 — Project foundation
- Nuxt 4 + TypeScript + Tailwind SPA (`ssr: false`)
- Repository layout matching spec §16.7
- Drizzle schema for D1 tables
- Unified API error shape
- Vitest unit tests + GitHub Actions CI
- `wrangler.jsonc` stub for Cloudflare Workers / D1

### Phase 1 — Usable without AI
- Profile (skills / achievements / capacity / NG)
- Pipeline list + status filters
- Home empty state + KPI funnel (分子/分母)
- localStorage persistence for dogfooding

### Phase 2 — Judgment (rule-first)
- Rule-based safety catalog + engine
- Heuristic extraction / effort / 5-axis diagnosis fallback
- Recommendation rules (apply / question / skip) computed in app code
- Fee / take-home / effective hourly helpers (not delegated to AI)

### Phase 3 — Acquisition support (MVP slice)
- Proposal generation via AI provider interface
- Fallback template when no external AI key is configured
- Copy + separate “mark as applied” actions

## Not yet (later phases)
- Cloudflare Access JWT auth
- Live D1 repositories / migrations apply
- External AI providers (Anthropic / Workers AI) wiring
- Opportunity detail page, reply assist, work logs, financial results
- Effort task editing UI
- BLOCK resolve history UI
- Idempotency keys + AI usage counters
