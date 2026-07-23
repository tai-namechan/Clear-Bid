---
name: review-only
description: >-
  コードレビュー専用の思考フレームワーク。
  変更差分の妥当性を確認し、提案・根拠・影響範囲・テスト観点のみを出す。
  コード変更は一切行わない（No Patch / No Apply）。
---

# Skill: Review Only (No Patch / No Apply)

## 目的

- **コード変更はしない**
- 基準は `architecture-layers.mdc` / `clear-bid-domain.mdc`
- 共通概念は [../_shared/analysis-concepts.md](../_shared/analysis-concepts.md)

## 手順

1. 差分の全ファイルを Read する
2. Why を根拠ベースで整理
3. Data Cardinality / Ops Delta を確認
4. 影響範囲を Grep で洗い出す
5. レイヤー・ドメイン不変条件・テストを確認
6. 地雷チェック

## 出力フォーマット

1. Why
2. Data Cardinality
3. Ops Delta
4. リスクと影響範囲
5. テスト観点
6. 自己検証
7. 地雷チェック
