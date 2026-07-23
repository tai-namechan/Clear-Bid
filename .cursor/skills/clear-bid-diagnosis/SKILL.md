---
name: clear-bid-diagnosis
description: >-
  Clear Bid の案件診断フロー（入力・抽出・安全・工数・5軸・提案・パイプライン）を
  変更・拡張するときの思考フレームワーク。仕様不変条件の確認と受入条件作成に使う。
---

# Skill: Clear Bid Diagnosis Flow

## 目的

- 診断フロー変更時に、仕様の不変条件を落とさない
- 詳細は `clear-bid-domain.mdc` と `docs/clear-bid-spec-v1.0.pdf`

## 変更前チェック

- [ ] 総合点/スコアバーを追加していないか
- [ ] 金額計算を AI に移していないか
- [ ] AI 推定だけで BLOCK にしていないか
- [ ] 引用なし BLOCK を保存していないか
- [ ] 推定情報をユーザー確認前に計算へ使っていないか
- [ ] 提案を1操作で複数案生成していないか
- [ ] コピーと応募済みを同一操作にしていないか
- [ ] skipped/lost/cancelled の理由必須を壊していないか

## フロー上の置き場所

| ステップ | 主なコード |
|---------|-----------|
| 入力 | `app/pages/diagnose.vue`, `StepInput` |
| 抽出 | `server/api/ai/extract`, AI provider |
| 安全・工数 | `server/rules`, `server/api/ai/safety-effort` |
| 5軸・判断 | `server/domain/recommendation`, diagnose API |
| 提案 | `server/api/ai/proposal` |
| パイプライン | composables store, pipeline pages |

## 出力

1. 変更目的
2. 不変条件チェック結果
3. 影響ステップ
4. 実装方針（最小差分）
5. 受入条件（Given/When/Then）
6. テスト観点
7. 後回し領域（Access/D1/外部AI）への誤進入がないか
