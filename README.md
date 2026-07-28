# Clear Bid

取るべき案件を、クリアに。

副業エンジニア向けの案件診断・提案支援 MVP。募集文を貼り付け、安全性・工数・採算・適合を整理したうえで応募判断と提案文作成を支援します。

## 技術スタック

- Nuxt 4 / Vue 3 / TypeScript / Tailwind / Nitro
- Zod（AI構造化出力の検証）
- Anthropic（外部 AI）+ fallback
- Cloudflare Workers + D1 + Access
- Drizzle ORM / Vitest

## 開発

```bash
pnpm install
cp .env.example .env
# ANTHROPIC_API_KEY を入れると提案文が本番品質寄りになります
pnpm dev
```

http://localhost:3000

```bash
pnpm test
pnpm build
```

## セットアップ手順（初めての人向け）

**これから（推奨）: Vercel + Supabase にまとめる**  
https://github.com/tai-namechan/Clear-Bid/blob/main/docs/manual/supabase-vercel-migration.md

Cloudflare の消し方も同ドキュメントに記載。

旧 Cloudflare 手順（参考）:  
[`docs/manual/clear-bid-setup-manual.md`](docs/manual/clear-bid-setup-manual.md)

技術者向け: [`docs/DEPLOY.md`](docs/DEPLOY.md)

```bash
pnpm deploy
```

## いまできること

- 診断フロー（入力 → 抽出 → 安全・工数 → 5軸 → 提案文）
- 返信支援・応募確認・提案型の再生成
- ルールベースの安全性 / 推奨 / 金額計算（AI に委譲しない）
- D1 同期（本番）+ localStorage キャッシュ
- Cloudflare Access による自分だけログイン

## 仕様

- `docs/clear-bid-spec-v1.0.pdf`
- `docs/IMPLEMENTATION.md`
