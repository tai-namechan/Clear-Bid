---
name: perf-review
description: >-
  パフォーマンスレビュー用の思考フレームワーク。
  一覧遅延・ループ追加・大量データ処理・N+1 の疑いがある変更をレビューし、
  危険な変更を止めるときに使用する。実装・パッチは出さない（提案のみ）。
---

# Skill: Performance Review (Stop Dangerous Changes)

共通概念は [../_shared/analysis-concepts.md](../_shared/analysis-concepts.md)、
数値基準は `db-memory-performance.mdc` を参照。

## 手順

1. Data Cardinality を取得コード根拠で確定
2. Filter Location を判定（クエリ側優先）
3. Ops Delta を数で示す
4. 最悪ケースを検証
5. 安全案 A/B を提示

## 出力フォーマット

1. Data Cardinality
2. Filter Location
3. Ops Delta
4. リスク
5. 安全案A/B
6. テスト観点
