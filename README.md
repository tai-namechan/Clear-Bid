# Clear Bid

取るべき案件を、クリアに。

副業エンジニア向けの案件診断・提案支援 MVP。募集文を貼り付け、安全性・工数・採算・適合を整理したうえで応募判断と提案文作成を支援します。

## 技術スタック

- Nuxt 4 / Vue 3 / TypeScript
- Tailwind CSS
- Zod（AI構造化出力の検証）
- Drizzle ORM schema（Cloudflare D1 向け。Phase 0 で定義）
- Vitest

## 開発

```bash
pnpm install
pnpm dev
```

http://localhost:3000 でモバイル幅（最大 430px）の SPA が開きます。

```bash
pnpm test
pnpm build
```

## 現在の実装範囲（Phase 0〜2 土台）

- ホーム / 診断 / 案件 / 自分 の 4 タブ UI
- 診断フロー: 入力 → 抽出確認 → 安全・工数 → 5軸結果 → 提案文
- ルールベース安全チェック（初期カタログ）
- 手数料・手取り・実質時給・判断候補のアプリ側計算
- AI プロバイダー抽象化 + オフライン fallback（API キーなしでも診断可能）
- localStorage によるプロフィール・パイプライン・統計の永続化
- D1 向け Drizzle schema

## 環境変数

`.env.example` を参照。外部 AI を使う場合のみ `ANTHROPIC_API_KEY` 等を設定します。未設定時は fallback プロバイダーが動作します。

## 仕様書

`docs/clear-bid-spec-v1.0.pdf`
