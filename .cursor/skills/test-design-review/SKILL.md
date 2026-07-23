---
name: test-design-review
description: >-
  テスト設計レビュー用の思考フレームワーク。
  テストが壊れた・書き方が不明・エラー握りつぶしの疑いがある場合に、
  設計を正道に戻す。実装・パッチは出さない（提案のみ）。
---

# Skill: Test Design Review (No Swallowing Errors)

詳細基準は `test-quality-standards.mdc`。

## 禁止

- エラー握りつぶしで通す提案
- 実装詳細依存テストへの寄せ
- `expect(true).toBe(true)` を証拠にする提案

## 手順

1. 対象の実装コードを Read
2. 近傍の既存テストを最低2つ Read
3. 契約（保証すべきこと）を1〜3行で書く
4. Unit vs Integration を切り分ける
5. Unit 最小案と Integration/E2E シナリオを提示
6. 再発防止チェック項目を出す

## 出力フォーマット

1. 契約
2. Unit vs Integration 切り分け
3. Unit 最小案
4. Integration/E2E 案
5. 再発防止チェックリスト
