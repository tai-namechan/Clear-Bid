# Clear Bid Agent Guide

取るべき案件を、クリアに。

## スタック

Nuxt 4 / Vue 3 / TypeScript / Tailwind / Nitro。  
永続化は Cloudflare D1（`user_documents`）+ localStorage キャッシュ。  
認証は Cloudflare Access JWT。AI は Anthropic（失敗時フォールバック）。

## 必読ルール

`.cursor/rules/` を常時適用。特に:

- `global-workflow.mdc` — 差分最小・仕様変更禁止
- `architecture-layers.mdc` — レイヤー責務
- `clear-bid-domain.mdc` — 診断ドメインの不変条件
- `project-specific.mdc` — 環境・コマンド

## スキル

`.cursor/skills/`。ルーティングは `task-skill-routing.mdc`。

## 仕様

- `docs/clear-bid-spec-v1.0.pdf`
- `docs/IMPLEMENTATION.md`
- `docs/DEPLOY.md`

## やってはいけないこと（要約）

- 金額計算・BLOCK 最終確定を AI に任せる
- 総合点バーを作る
- スクレイピング / 自動応募
