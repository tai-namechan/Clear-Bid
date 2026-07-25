# Clear Bid セットアップマニュアル

> **スマホで読む用（このページ）**  
> GitHub 上のこの Markdown は、そのままマニュアル画面として読めます。  
> HTML 版は GitHub / jsDelivr だと「コードの文字」になってしまうため、スマホでは **このページを使ってください**。

取るべき案件を、クリアに。  
この手順書は、Clear Bid を「自分のPCで使う」ところから「自分専用でインターネット公開する」ところまで、クリック順と理由つきで説明します。

- 対象: 自分1人で使う
- 所要目安: 半日〜1日（初回）
- 最終更新: 2026-07-25

---

## 目次

0. [ゴールと全体像](#0-ゴールと全体像)
1. [準備するもの](#1-準備するもの)
2. [パソコンで Clear Bid を動かす](#2-パソコンで-clear-bid-を動かす)
3. [Anthropic（外部AI）のAPIキーを取る](#3-anthropic外部aiのapiキーを取る)
4. [ローカルで提案文を本番寄りにする](#4-ローカルで提案文を本番寄りにする)
5. [Cloudflare にログインして準備する](#5-cloudflare-にログインして準備する)
6. [D1データベースを作る](#6-d1データベースを作るデータを消さない箱)
7. [設定ファイルにデータベースIDを書く](#7-設定ファイルにデータベースidを書く)
8. [テーブルを作る（マイグレーション）](#8-テーブルを作るマイグレーション)
9. [Cloudflare Access で自分だけ入れるようにする](#9-cloudflare-access-で自分だけ入れるようにする)
10. [秘密情報（Secrets）を入れる](#10-秘密情報secretsを-workers-に入れる)
11. [デプロイ（公開）](#11-デプロイインターネットに公開)
12. [公開後の動作確認](#12-公開後の動作確認)
13. [日々の使い方](#13-日々の使い方)
14. [困ったとき](#困ったとき)
15. [最終チェックリスト](#最終チェックリスト)

---

## 0. ゴールと全体像

最終的にこうなります。

| やること | 結果 |
|---|---|
| 1. 外部AI（Anthropic） | 提案文・抽出・返信案が、実際に応募して恥ずかしくない水準になる |
| 2. D1保存 | 案件・診断履歴・作業時間が、ブラウザを変えても消えない |
| 3. Access認証 | インターネット上にあっても、自分以外は入れない |

### なぜこの順番？

まず AI キーで「提案文の質」を確認 → 次にデータを残す箱（D1）→ 最後に鍵（Access）をかけて公開。  
先に公開だけすると、中身の薄いアプリが外に出ます。

### 大事な注意

- APIキーやパスワードは、チャット・スクショ・GitHub に貼らない
- 画面の文言は Cloudflare / Anthropic 側の更新で少し変わることがあります。近い名前を探してください

---

## 1. 準備するもの

| 必要なもの | 何のため | 費用の目安 |
|---|---|---|
| GitHub + Clear Bid リポジトリ | プログラムを置く | 無料 |
| Node.js（22以上推奨）と pnpm | PC上でアプリを動かす | 無料 |
| Anthropic アカウント | 提案文などを賢くするAI | 従量課金（少額から可） |
| Cloudflare アカウント | 公開・DB・自分専用ログイン | 個人利用なら無料枠で足りることが多い |
| 自分のメールアドレス | Access で「自分だけ」許可 | — |

### 1-1. Node.js が入っているか確認

1. ターミナルを開く（Mac: ターミナル / Windows: PowerShell）
2. 次を打ち込んで Enter

```bash
node -v
pnpm -v
```

- 成功: `v22.x.x` と pnpm の数字が出る
- 出てこない: [nodejs.org](https://nodejs.org/) から LTS を入れ、その後 `npm install -g pnpm`

---

## 2. パソコンで Clear Bid を動かす

### なぜ先にローカル？

公開前に「画面が開く」「診断できる」を確認すると、あとで設定ミスを切り分けやすいです。

### 手順

**① プロジェクトフォルダへ移動**

```bash
cd /path/to/Clear-Bid
```

**② 依存パッケージを入れる**

```bash
pnpm install
```

なぜ？ → アプリが使う部品をダウンロードする作業です。初回は数分かかります。

**③ 環境変数ファイルを作る**

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

なぜ `.env`？ → APIキーをプログラムに直書きせず、GitHub に上がらない自分用の設定ファイルにします。

**④ 開発サーバーを起動**

```bash
pnpm dev
```

ブラウザで開く: `http://localhost:3000`

成功: ホーム / 診断 / 案件 / 自分 の画面が出る。  
この時点では AI キーがなくても簡易モードで動きます。

---

## 3. Anthropic（外部AI）のAPIキーを取る

Anthropic は提案文・抽出を賢くするサービスです。  
APIキーは「あなたの Clear Bid だけが Anthropic を使えるようにするパスワード」です。

### 手順（クリック順）

1. ブラウザで開く: [https://console.anthropic.com/](https://console.anthropic.com/)
2. 右上の **Sign in / Log in** をクリック
3. Google やメールでアカウント作成・ログイン
4. 初回なら利用規約に同意。必要なら **Billing（支払い）** を登録
5. 左メニュー（または設定）から **API Keys** をクリック
6. **Create Key** をクリック
7. 名前は `clear-bid-local` など分かりやすくする
8. 表示されたキー（だいたい `sk-ant-` で始まる）をコピーしてメモ

### なぜ支払い登録？

無料枠だけでは足りない場合や、安定利用のためにカード登録が必要なことがあります。少額の利用上限を先に設定すると安心です。

### 超重要

キーは一度しか出ないことが多いです。  
GitHub / Slack / LINE に貼ると危険。漏れたらすぐ削除して作り直します。

---

## 4. ローカルで提案文を本番寄りにする

### ① `.env` を編集

Cursor / VS Code / メモ帳でプロジェクト直下の `.env` を開き、次のようにします。

```bash
AI_PROVIDER=auto
ANTHROPIC_API_KEY=sk-ant-ここに貼る
AI_MONTHLY_BUDGET_USD=3

AUTH_BYPASS=true
DEV_USER_EMAIL=あなたのメール@example.com
```

| 項目 | 入れる値 | 意味 |
|---|---|---|
| `AI_PROVIDER` | `auto` | キーがあれば Anthropic、なければ簡易モード |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | AIを使う鍵 |
| `AUTH_BYPASS` | `true` | ローカルではログイン省略（開発用） |
| `DEV_USER_EMAIL` | 自分のメール | ローカル時の仮ユーザー |

### ② サーバー再起動して確認

1. ターミナルで `Ctrl + C` で `pnpm dev` を止める
2. もう一度 `pnpm dev`
3. ブラウザで `http://localhost:3000/api/health` を開く

成功の例:

```json
{
  "ok": true,
  "anthropicConfigured": true
}
```

その後「診断」で実案件の募集文を貼り、提案文まで進めてください。

---

## 5. Cloudflare にログインして準備する

Cloudflare は、Clear Bid をインターネットに置いて動かす場所です。  
データベース（D1）と自分専用ログイン（Access）もここで作ります。

### ① アカウント作成 / ログイン

1. [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) を開く
2. メールで Sign up または Log in
3. ダッシュボードが開けばOK

### ② パソコンから Cloudflare を操作できるようにする

```bash
pnpm exec wrangler login
```

1. コマンドを実行するとブラウザが開く
2. **Allow（許可）** をクリック
3. ターミナルに成功メッセージが出ればOK

なぜ？ → このあと「DB作成」「公開」をコマンドで行うためです。

---

## 6. D1データベースを作る（データを消さない箱）

ローカルだけだと、データはその端末のブラウザ内（localStorage）にあります。  
D1 は Cloudflare 上のDBで、別の端末でも同じ履歴を見られるようにします。

### ① D1 を作成

```bash
pnpm exec wrangler d1 create clear-bid
```

成功すると、だいたい次のような情報が出ます。

```toml
[[d1_databases]]
binding = "DB"
database_name = "clear-bid"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**やること:** `database_id` の長い英数字をコピーして控える。

### ②（任意）ダッシュボードでも確認

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) を開く
2. 左メニュー **Workers & Pages**（または Workers）
3. **D1** をクリック
4. `clear-bid` があることを確認

---

## 7. 設定ファイルにデータベースIDを書く

Clear Bid に「どのD1を使うか」を教えます。

1. プロジェクト直下の `wrangler.jsonc` を開く
2. `REPLACE_WITH_D1_ID` を探す
3. さっき控えた `database_id` に置き換える

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "clear-bid",
    "database_id": "ここにコピーしたID",
    "migrations_dir": "db/migrations"
  }
]
```

なぜ？ → `binding: "DB"` は「プログラムから DB という名前でこのデータベースを使う」という意味です。

注意: APIキーは絶対にこのファイルへ書かない。

---

## 8. テーブルを作る（マイグレーション）

DBを作っただけでは空っぽの箱です。  
マイグレーションは、箱の中に「ユーザー」「案件」などの棚（テーブル）を作る作業です。

### 本番（リモート）へ反映

```bash
pnpm db:migrate:remote
```

確認を聞かれたら Yes / `y`。  
成功: `0001_init` などが Applied / success。

### （任意）ローカル用

```bash
pnpm db:migrate:local
```

---

## 9. Cloudflare Access で自分だけ入れるようにする

Access は門番です。URLを知っていても、許可したメールでログインした人だけ入れます。

### ① Zero Trust を開く

1. [https://one.dash.cloudflare.com/](https://one.dash.cloudflare.com/) を開く
2. 初回ならチーム名（Team name）を決める。例: `namety`
3. このチーム名が後で `CF_ACCESS_TEAM_DOMAIN` になります（`.cloudflareaccess.com` は付けない）

なぜチーム名？ → ログイン画面の住所が `https://チーム名.cloudflareaccess.com` になるためです。

### ② Application（守るアプリ）を作る

1. 左メニュー **Access** → **Applications**
2. **Add an application**
3. **Self-hosted** を選ぶ
4. Application name: `Clear Bid`
5. Session Duration: 例 `24 hours`
6. Application domain / URL: あとで分かる Workers のURL  
   （例: `clear-bid.xxxxx.workers.dev`）  
   まだデプロイ前なら、デプロイ後に戻って設定でもOK
7. **Next**

### ③ Policy（誰を通すか）

1. Policy name: `Only me`
2. Action: **Allow**
3. Include で **Emails** を選ぶ
4. Value に自分のメールを入れる
5. **Next** → Save / Add application

なぜメール指定？ → 「リンクを知っている人なら誰でも入れる」状態を防ぐため。案件情報・金額が入るので必須です。

### ④ AUD を控える

1. Applications 一覧で **Clear Bid** をクリック
2. **Application Audience (AUD)** を探す
3. 長い文字列をコピー

| 変数名 | 値の例 | どこで取る |
|---|---|---|
| `NUXT_CF_ACCESS_TEAM_DOMAIN` | `namety` | Zero Trust のチーム名 |
| `NUXT_CF_ACCESS_AUD` | 長い英数字 | Application の AUD |

---

## 10. 秘密情報（Secrets）を Workers に入れる

本番では `.env`（PCの中だけのもの）は使えません。  
Cloudflare Workers の Secrets に入れます。

### 入れるもの

| 名前 | 入れる内容 | なぜ必要 |
|---|---|---|
| `NUXT_ANTHROPIC_API_KEY` | `sk-ant-...` | 本番でも賢い提案文 |
| `NUXT_AI_PROVIDER` | `auto` | キーがあるとき Anthropic を使う |
| `NUXT_CF_ACCESS_TEAM_DOMAIN` | チーム名 | Access 通行証の検証 |
| `NUXT_CF_ACCESS_AUD` | AUD | このアプリ宛の通行証か確認 |
| `NUXT_AUTH_BYPASS` | `false` | 本番で門番をスキップしない |

### 方法A: ダッシュボード（わかりやすい）

1. Cloudflare Dashboard → **Workers & Pages**
2. `clear-bid` をクリック（デプロイ後）
3. **Settings**
4. **Variables and Secrets**
5. **Add** → 種類 **Secret** で名前と値を入れる
6. 上の表を1つずつ追加して Save / Deploy

### 方法B: コマンド

```bash
pnpm build
pnpm exec wrangler secret put NUXT_ANTHROPIC_API_KEY --config .output/server/wrangler.json
pnpm exec wrangler secret put NUXT_CF_ACCESS_AUD --config .output/server/wrangler.json
pnpm exec wrangler secret put NUXT_CF_ACCESS_TEAM_DOMAIN --config .output/server/wrangler.json
```

値を聞かれたら貼り付けて Enter。

---

## 11. デプロイ（インターネットに公開）

デプロイ = 自分のPCのアプリを Cloudflare に上げて、URLで開けるようにすること。

```bash
pnpm deploy
```

成功すると `https://clear-bid.xxxxx.workers.dev` のようなURLが出ます。控えてください。

その後、Access の Application URL をこのURLに合わせます。

1. Zero Trust → Access → Applications → Clear Bid
2. Application domain を今の Workers URL にする
3. Save

---

## 12. 公開後の動作確認

### ① 門番が出るか

1. ブラウザのシークレットウィンドウで Workers URL を開く
2. Cloudflare Access のログイン画面が出る
3. 許可した自分のメールでログイン
4. Clear Bid の画面が開く

門番なしで誰でも見えたら危険です。Access URL と `NUXT_AUTH_BYPASS=false` を確認。

### ② ヘルスチェック

ログイン後に開く:

`https://（あなたのURL）/api/health`

理想:

```json
{
  "ok": true,
  "persistence": "d1",
  "anthropicConfigured": true,
  "accessConfigured": true
}
```

### ③ 保存確認

「自分」タブでプロフィールを保存 → 別ブラウザで再ログインして残っているか確認。  
接続状態が **Cloudflare D1** ならOK。

---

## 13. 日々の使い方

1. 公開URLを開き、Access でログイン
2. 「自分」でスキル・実績・稼働条件を入れる
3. 募集文を「診断」に貼る
4. 抽出確認 → 診断 → 提案文をコピーして応募
5. 実際に応募したら「応募済みとして記録」（コピーだけでは応募済みにならない）
6. 返信が来たら案件詳細の「返信」に貼って回答案を作る

Clear Bid は自動応募しません。最終操作はあなたです。  
危険案件の BLOCK や金額計算も、AIではなくアプリのルールが担当します。

---

## 困ったとき

| 症状 | まず疑うこと | 対処 |
|---|---|---|
| `anthropicConfigured: false` | キー未設定 / 名前間違い | ローカルは `.env` の `ANTHROPIC_API_KEY`。本番は `NUXT_ANTHROPIC_API_KEY` |
| `persistence: "local"` のまま | D1未作成 / ID未記入 / マイグレ未実施 | 章6〜8 → 再デプロイ |
| 401 Unauthorized | Access未ログイン / AUD不一致 | 正しいメールでログイン。AUDとチーム名を見直す |
| 提案文がテンプレっぽい | フォールバック動作中 | キーと `/api/health` を確認。実績を充実 |
| `pnpm deploy` 失敗 | 未ログイン / IDが REPLACE のまま | `wrangler login` と章7 |
| HTMLマニュアルがコード表示 | GitHub Raw / jsDelivr の仕様 | **この Markdown ページ**を使う |

---

## 最終チェックリスト

- [ ] Node.js と pnpm が入っている
- [ ] `pnpm install` と `pnpm dev` で画面が開く
- [ ] Anthropic の API キーを発行した（チャットに貼っていない）
- [ ] ローカル `.env` にキーを入れ、`anthropicConfigured: true`
- [ ] 実案件で提案文まで試した
- [ ] `wrangler login` 済み
- [ ] D1 `clear-bid` を作成し、`wrangler.jsonc` に ID を書いた
- [ ] `pnpm db:migrate:remote` 成功
- [ ] `pnpm deploy` で URL を取得
- [ ] Access で自分のメールだけ Allow
- [ ] Secrets を入れ、`AUTH_BYPASS=false`
- [ ] シークレットウィンドウで門番 → ログイン → 保存確認
- [ ] `/api/health` が d1 / anthropic / access すべて true 系

ここまでできたら、Clear Bid は仕事を取るための自分専用ツールとして使える状態です。
