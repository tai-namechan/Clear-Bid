# Implementation status

Based on Clear Bid MVP Spec v1.0.

## Done

### Phase 0 — Project foundation
- Nuxt 4 + TypeScript + Tailwind SPA (`ssr: false`)
- Repository layout matching spec §16.7
- Drizzle schema for D1 tables + SQL migrations
- Unified API error shape
- Vitest unit tests + GitHub Actions CI
- `wrangler.jsonc` for Cloudflare Workers / D1
- Cursor rules/skills (Clear Dawn 概念移植)

### Phase 1 — Usable without AI
- Profile / Pipeline / Opportunity 詳細
- ステータス・作業時間・金額・KPI
- localStorage persistence（端末キャッシュとして継続）

### Phase 2 — Judgment (rule-first)
- Safety rules / 抽出確定 / 工数編集 / BLOCK 解除 / 診断バージョン

### Phase 3 — Acquisition support
- 提案文・応募確認・型再生成・返信支援・AI Soft Gate

### Production wiring — AI / D1 / Access
- Anthropic provider（`AI_PROVIDER=auto|anthropic` + API key）
- 失敗時フォールバック provider
- D1 `user_documents` 同期 API（`/api/sync`）+ store デュアルライト
- Cloudflare Access JWT 検証（未設定時は AUTH_BYPASS / 開発ユーザー）
- `/api/me` `/api/health`、デプロイ手順は `docs/DEPLOY.md`

### FLEXY support
- Platform `flexy`（表示名 FLEXY、手数料初期値 0%、案件単位で上書き可）
- 月額・稼働日数の決定的パーサ（週N日→月間時間の勝手換算なし）
- 必須要件エビデンス確認（supported/partial/unverified/unsupported）
- 継続案件向け完遂・採算判定（domain 層）
- `interest_message`（FLEXY担当者向け応募希望メッセージ）
- 旧プロフィール / JobInput の `normalizeProfile` / `normalizeJobInput`

### Platform application judgment（媒体別の応募判断・応募メッセージ）
正本 PDF（`docs/clear-bid-spec-v1.0.pdf`）を補完する実装仕様。衝突時は本節を優先し、既存データの後方互換を維持する。

#### 目的
募集文の一般的な提案文生成ではなく、媒体別の応募判断と応募メッセージ生成を一続きで支援する。

#### 対応媒体（`source_platform`）
- `youtrust`（YouTrust）
- `flexy`（FLEXY）
- `crowdworks`（クラウドワークス）
- `coconala`（ココナラ）
- `lancers`（ランサーズ）
- `other`（その他）

URL スクレイピングは対象外。貼り付け文面からの推定は可。ユーザー修正を優先。

#### 入力項目（診断 StepInput）
- 募集媒体 / 案件タイトル / 会社名 / 募集者名（任意） / 募集詳細 / 募集URL（任意）
- 応募形式（`application_type`）: `standard` | `casual_talk` | `hear_more` | `unknown`

#### 既存推奨との関係
- 既存 `recommendation`（`apply` / `question` / `skip`）と 5軸評価は維持
- 追加の推奨アクション `recommended_action`:
  - `apply` / `casual_talk` / `confirm_conditions` / `skip`
- 応募優先度 `application_priority`: `high` | `medium` | `low`
- 判定ラベル（表示用）: `攻め時` | `様子見` | `見送り`（既存 REC と併記可）
- `overall_score`（0〜100）は構造化メタデータとして保持。スコアバー UI は禁止

#### 要件分類（プロフィール比較）
各必須／歓迎要件を次へ分類する（AI がプロフィールにない経験を補完しない）:
- `matched` / `transferable` / `unverified` / `missing`
各項目: 要件 / 必須|歓迎 / 判定 / 判定根拠 / 応募時の扱い

関心領域（`interestAreas`）はスキルマッチ加点に使わず、応募理由生成に使う。実務と個人開発・学習中を区別する。

#### 条件リスク検出
正社員転換前提・平日日中MTG・常時対応・稼働超過・専門必須・報酬不明・責任過大などを検出して総合判断へ反映。

#### 診断結果表示
- 応募判断（推奨アクション・優先度・総合スコア数値・判定ラベル・理由）
- 経験との接点（最大3・根拠紐付け）
- 足りない点（gaps / condition_risks）
- 面談・応募前確認（最大3）

#### 媒体別メッセージ
- YouTrust: 興味対象1つ + 200字以内一言（3案UIなし）。改行・記号込みで文字数計測
- FLEXY: 既存 `interest_message` を継続
- CW / ココナラ / ランサーズ: 既存 300〜400字提案文
- その他: 短文 / 長文を選択可

品質ルール: 募集固有語・具体経験接点・次アクションの3要素。誇張禁止。不足は明示可。

#### パイプライン
追加状態: 検討中(`review`) / 話を聞きたい送信済み(`casual_sent`) / 応募済み / 返信あり / 面談 / 受注 / 見送り / 失注
案件へ保存: 媒体・応募形式・推奨/実際アクション・生成メッセージ・応募日時・診断スナップショット

#### AI Soft Gate
媒体別短文も `proposal` 枠。診断のみでは生成枠を消費しない。

#### 構造化出力
`DiagnosisResult` / `ProposalResult` を後方互換で拡張。Zod 検証必須。不正時は再試行またはフォールバック。プロンプト全文・個人情報・APIトークンはログ禁止。

## Notes
- Money / recommendation / BLOCK の最終確定は AI に委譲しない
- Workers AI は未配線（Anthropic を本番パスとする）
- 正規化テーブル（opportunities 等）はスキーマ上あり。現行ランタイムは documents 同期
- パイプライン詳細の手数料表示はプロフィール基準のまま（案件別手数料の詳細 UI は後続）
