# Clear Bid Agent Guide

取るべき案件を、クリアに。

## スタック

Nuxt 4 / Vue 3 / TypeScript / Tailwind / Nitro。永続化は当面 localStorage。D1・Access・外部 AI 本接続は後続。

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

## やってはいけないこと（要約）

- 金額計算・BLOCK 最終確定を AI に任せる
- 総合点バーを作る
- スクレイピング / 自動応募
- Access / 本番 D1 / 外部 AI をユーザー指示前に本実装する
