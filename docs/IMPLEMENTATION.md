# Implementation status

Based on Clear Bid MVP Spec v1.0.

## Done

### Phase 0 — Project foundation
- Nuxt 4 + TypeScript + Tailwind SPA (`ssr: false`)
- Repository layout matching spec §16.7
- Drizzle schema for D1 tables
- Unified API error shape
- Vitest unit tests + GitHub Actions CI
- `wrangler.jsonc` stub for Cloudflare Workers / D1
- Cursor rules/skills (Clear Dawn 概念移植)

### Phase 1 — Usable without AI
- Profile (skills / achievements / capacity / NG)
- Pipeline list + status filters（判断中〜入金済み）
- Opportunity 詳細（概要 / ステータス履歴 / 作業時間 / 金額）
- ステータス遷移（理由必須: 見送り・失注・キャンセル）
- 作業時間・見積り誤差率・実績時給
- 契約額・手数料・税引前手取り・入金
- Home empty state + KPI funnel + 次のアクション
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

## Deferred (最後にまとめて)
- Cloudflare Access JWT auth
- Live D1 repositories / migrations apply
- External AI providers (Anthropic / Workers AI) wiring

## Still open before Phase 2/3 completion PRs
- Effort task editing UI
- BLOCK resolve history UI
- Extraction confirm/edit
- Diagnosis versions
- Reply assist / re-diagnose / usage counters / apply confirm dialog
