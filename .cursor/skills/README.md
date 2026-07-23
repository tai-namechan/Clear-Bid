# Clear Bid Cursor Skills

Clear Dawn（Laravel）の概念スキルを、Clear Bid（Nuxt / TypeScript）向けに再調整したもの。

## 使い方

- Agent がタスク種別に応じて自動参照（`.cursor/rules/task-skill-routing.mdc`）
- 手動ではチャットで `/スキル名` または `@スキル`

## 一覧

| スキル | 用途 |
|--------|------|
| `spec` | 仕様・設計判断 |
| `bugfix` | バグ修正（最小差分） |
| `incident` | 障害調査 |
| `review-only` | レビューのみ（No Patch） |
| `perf-review` | パフォーマンス危険変更の停止 |
| `test-design-review` | テスト設計レビュー |
| `nuxt-vue-patterns` | Vue/Nuxt UI |
| `nuxt-server-patterns` | server/api・domain・rules・ai |
| `clear-bid-diagnosis` | 診断フロー変更 |

共通定義: `_shared/analysis-concepts.md`

## Clear Dawn から持ち込まないもの

- `laravel-best-practices` / Fortify / Socialite / Wayfinder / Inertia 専用スキル
- Laravel Cloud デプロイスキル

必要になったら Cloudflare Workers / D1 / Access 用スキルを別途追加する。
