---
name: nuxt-server-patterns
description: >-
  Nuxt server routes / Nitro / domain / rules / AI provider の実装パターン。
  server/api・server/domain・server/rules・server/ai・shared/schemas を
  変更・追加するときに使用する。
---

# Nuxt Server Patterns（Clear Bid）

## 配置

```
server/
├── api/          # HTTP エンドポイント
├── domain/       # 決定的ロジック（金額・判断候補）
├── rules/        # 安全ルールカタログとエンジン
├── ai/           # プロバイダー抽象
└── utils/        # エラー形式など
shared/
├── schemas/      # Zod
├── types/        # TS 型
├── constants/    # 表示定数
└── domain/       # フロントからも使う決定的ロジック
```

## API

- 統一エラー: `createErrorBody`
- 入力は Zod で検証。失敗時は業務データへ保存しない
- 所有者認可は API 接続後必須（Access/D1 後続フェーズでも設計上忘れない）

## Domain vs AI

| 処理 | 置き場所 |
|------|----------|
| 手数料・手取り・時給 | domain |
| 判断候補 apply/question/skip | domain |
| 安全ルール判定 | rules |
| 抽出・提案文・意図推定 | ai provider |
| BLOCK 最終確定 | rules + ユーザー解除（AI単独禁止） |

## AI Provider

- 業務コードに実モデル名を直書きしない
- fallback でキーなし動作を維持する
- 構造化出力は Zod 検証
- 失敗時に利用枠を消費しない（利用枠実装後）

## テスト

- domain / rules は Unit で厚くカバー
- API は外部 HTTP を投げない
