---
name: bugfix
description: >-
  バグ修正（最小差分）用の思考フレームワーク。
  「動かない」「表示されない」「エラーが出る」等の不具合報告を受けて
  原因調査・修正提案を行うときに使用する。
  確信度80%未満ではパッチを出さず調査項目のみ提示する。
---

# Skill: Bugfix (Minimal Diff)

共通概念は [../_shared/analysis-concepts.md](../_shared/analysis-concepts.md) を参照。

## 入力情報

- [タイトル] / [画面/機能]
- [現象] / [期待] / [再現手順]
- [補足]
- SEARCH_SCOPE

## 手順

### Step 1: 調査（コードを書かない）
1. SEARCH_SCOPE 内で関連ファイル候補を列挙
2. 類似実装を最大3件 Read
3. データフローを page → composable → api → domain/rules まで追跡
4. Data Cardinality / Filter Location / Ops Delta を確定

### Step 2: 原因確定
5. 原因を1つに絞る（80%未満ならパッチ禁止）
6. 実コード行を引用して説明できること

### Step 3: 修正提案
7. 最小差分のパッチ案
8. テスト方針
9. 影響範囲
10. 地雷チェック

## 出力フォーマット

1. 関連ファイル
2. 類似実装（最大3件）
3. Data Cardinality / Filter Location / Ops Delta
4. 原因（1つ）
5. 修正方針
6. パッチ案（80%以上のみ）
7. テスト
8. 影響範囲
9. 自己検証
10. 地雷チェック
