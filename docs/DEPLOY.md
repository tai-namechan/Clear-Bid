# Deploy guide — Vercel + Supabase

Clear Bid の本番構成は **Vercel + Supabase** です（Clear Invoice と同じ系統）。

詳細手順（クリック順・Cloudflare の消し方）:

- [`docs/manual/supabase-vercel-migration.md`](./manual/supabase-vercel-migration.md)

## 最短手順

1. Supabase でプロジェクト作成
2. SQL Editor で `supabase/migrations/20260812_user_documents_rls.sql` を実行
3. Auth → Email ON。Users で自分を作成（またはアプリから登録）
4. `.env` / Vercel Env に設定:

```bash
NUXT_PUBLIC_SUPABASE_URL=...
NUXT_PUBLIC_SUPABASE_ANON_KEY=...
NUXT_SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
ALLOWED_EMAIL=you@example.com   # 任意。空なら認証済み全員OK
```

5. Vercel に Import → Deploy（Nitro preset: `vercel`）
6. ログイン → バックアップ JSON を取り込む
7. 問題なければ旧 Cloudflare（Workers / D1 / Access）を削除

## セキュリティ（必須）

- 永続化は Supabase `user_documents` のみ（localStorage 本体は廃止）
- API は JWT 必須。`user_id` はトークンから決定（ボディの user_id は使わない）
- テーブルは **RLS**（`auth.uid() = user_id`）
