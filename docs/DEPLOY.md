# Deploy guide

## 方針（決定）

Clear Bid は **Vercel + Supabase** にまとめます（Clear Invoice と同じ系統）。  
Cloudflare Workers / D1 / Access は移行後に削除します。

**手順書（推奨・スマホ可）:**  
[`docs/manual/supabase-vercel-migration.md`](./manual/supabase-vercel-migration.md)

## 旧 Cloudflare 手順

移行完了までは参考用に残しています: [`docs/manual/clear-bid-setup-manual.md`](./manual/clear-bid-setup-manual.md)

---

# （旧）Deploy guide (AI + D1 + Access)

Clear Bid を自分用の仕事道具として Cloudflare に載せる手順。

**初めての人・画面クリックまで知りたい人はこちら（推奨）:**

- **スマホ:** [`docs/manual/clear-bid-setup-manual.md`](./manual/clear-bid-setup-manual.md)（GitHub上でそのまま読める）
- **PC:** [`docs/manual/clear-bid-setup-manual.html`](./manual/clear-bid-setup-manual.html) をローカルで開く / 印刷から PDF 保存

> GitHub Raw や jsDelivr の HTML は `text/plain` のためコード表示になります。スマホは Markdown を使ってください。

## 1. 前提

- Cloudflare アカウント
- Anthropic API キー
- （推奨）Cloudflare Zero Trust / Access アプリケーション

## 2. D1 作成

```bash
pnpm exec wrangler d1 create clear-bid
```

出力された `database_id` を `wrangler.jsonc` の `REPLACE_WITH_D1_ID` に入れる。

マイグレーション適用:

```bash
pnpm db:migrate:remote
```

ローカル検証用:

```bash
pnpm db:migrate:local
```

## 3. シークレット / 環境変数

Workers に設定（Dashboard または `wrangler secret put`）:

| 変数 | 用途 |
|------|------|
| `NUXT_ANTHROPIC_API_KEY` | Anthropic API キー |
| `NUXT_AI_PROVIDER` | `auto` または `anthropic` |
| `NUXT_CF_ACCESS_TEAM_DOMAIN` | Access チームサブドメイン（例: `myteam`） |
| `NUXT_CF_ACCESS_AUD` | Access Application の AUD |
| `NUXT_AUTH_BYPASS` | 本番は `false` |
| `NUXT_DEV_USER_EMAIL` | ローカル bypass 時のユーザー |

ローカル `.env`:

```bash
cp .env.example .env
# ANTHROPIC_API_KEY=sk-ant-...
# AI_PROVIDER=auto
# AUTH_BYPASS=true
```

## 4. Cloudflare Access

1. Zero Trust → Access → Applications で Workers の URL を保護
2. 自分のメールだけ許可する Policy を作る
3. Application Audience (AUD) と team domain を上記 env に設定
4. `NUXT_AUTH_BYPASS=false`

Access が前面にあるとブラウザはログイン後に `CF_Authorization` Cookie / `Cf-Access-Jwt-Assertion` を付与する。サーバーはその JWT を検証する。

## 5. デプロイ

マイグレーションはリポジトリ直下の `wrangler.jsonc` を使います（`pnpm db:migrate:remote`）。

アプリ本体:

```bash
pnpm deploy
```

（内部では `wrangler deploy --config .output/server/wrangler.json`）

確認:

```bash
curl https://<your-worker>/api/health
```

`persistence: "d1"` / `anthropicConfigured: true` / `accessConfigured: true` になれば OK。

Secrets は Dashboard または:

```bash
pnpm exec wrangler secret put NUXT_ANTHROPIC_API_KEY --config .output/server/wrangler.json
pnpm exec wrangler secret put NUXT_CF_ACCESS_AUD --config .output/server/wrangler.json
```

## 6. ローカル開発

```bash
pnpm dev
```

- Access 未設定 + `AUTH_BYPASS=true` → 開発ユーザーで API 利用可
- D1 未バインド → localStorage に保存（プロフィール画面に表示）
- `ANTHROPIC_API_KEY` があれば外部 AI、なければフォールバック

## 設計メモ

- 推奨・金額・BLOCK 確定は引き続きアプリ側ルール。AI は抽出・説明・提案文・返信案。
- D1 には `user_documents` として profile / pipeline / stats / ai_usage を保存（localStorage と同型）。正規化テーブルは将来用に同居。
- 端末キャッシュも残すので、オフライン時も読み取り可能。
