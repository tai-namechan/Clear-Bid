# Implementation status

Based on Clear Bid MVP Spec v1.0.

## Done

### Phase 0 — Project foundation
- Nuxt 4 + TypeScript + Tailwind SPA (`ssr: false`)
- Repository layout matching spec §16.7
- Drizzle schema for D1 tables + SQL migrations
- Unified API error shape
- Vitest unit tests + GitHub Actions CI
- `wrangler.jsonc` for Cloudflare Workers / D1
- Cursor rules/skills (Clear Dawn 概念移植)

### Phase 1 — Usable without AI
- Profile / Pipeline / Opportunity 詳細
- ステータス・作業時間・金額・KPI
- localStorage persistence（端末キャッシュとして継続）

### Phase 2 — Judgment (rule-first)
- Safety rules / 抽出確定 / 工数編集 / BLOCK 解除 / 診断バージョン

### Phase 3 — Acquisition support
- 提案文・応募確認・型再生成・返信支援・AI Soft Gate

### Production wiring — AI / D1 / Access
- Anthropic provider（`AI_PROVIDER=auto|anthropic` + API key）
- 失敗時フォールバック provider
- D1 `user_documents` 同期 API（`/api/sync`）+ store デュアルライト
- Cloudflare Access JWT 検証（未設定時は AUTH_BYPASS / 開発ユーザー）
- `/api/me` `/api/health`、デプロイ手順は `docs/DEPLOY.md`

### FLEXY support
- Platform `flexy`（表示名 FLEXY、手数料初期値 0%、案件単位で上書き可）
- 月額・稼働日数の決定的パーサ（週N日→月間時間の勝手換算なし）
- 必須要件エビデンス確認（supported/partial/unverified/unsupported）
- 継続案件向け完遂・採算判定（domain 層）
- `interest_message`（FLEXY担当者向け応募希望メッセージ）
- 旧プロフィール / JobInput の `normalizeProfile` / `normalizeJobInput`

## Notes
- Money / recommendation / BLOCK の最終確定は AI に委譲しない
- Workers AI は未配線（Anthropic を本番パスとする）
- 正規化テーブル（opportunities 等）はスキーマ上あり。現行ランタイムは documents 同期
- パイプライン詳細の手数料表示はプロフィール基準のまま（案件別手数料の詳細 UI は後続）
