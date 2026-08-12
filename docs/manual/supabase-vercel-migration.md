# Clear Bid を Supabase + Vercel にまとめる手順

> **スマホで読む用**  
> https://github.com/tai-namechan/Clear-Bid/blob/main/docs/manual/supabase-vercel-migration.md

Clear Invoice と同じ土台（**Vercel + Supabase**）に寄せるための手順書です。  
Clear Dawn（Laravel Cloud）は別のままです。

あわせて、いま入れてある **Cloudflare（Workers / D1 / Access）の消し方**も書きます。

---

## 目次

1. [全体像](#1-全体像)
2. [始める前（データ退避）](#2-始める前データ退避)
3. [Supabase プロジェクトを作る](#3-supabase-プロジェクトを作る)
4. [自分だけログインできるようにする](#4-自分だけログインできるようにする)
5. [テーブルを用意する](#5-テーブルを用意する)
6. [コード側の切り替え（実装作業）](#6-コード側の切り替え実装作業)
7. [Vercel に載せる](#7-vercel-に載せる)
8. [PCのデータを流し込む](#8-pcのデータを流し込む)
9. [動作確認](#9-動作確認)
10. [Cloudflare の消し方](#10-cloudflare-の消し方)
11. [最終チェックリスト](#11-最終チェックリスト)

---

## 1. 全体像

### これから

| 役割 | 使うもの | なぜ |
|---|---|---|
| アプリ公開 | **Vercel** | Clear Invoice と同じ |
| データベース | **Supabase（Postgres）** | 消えにくい・中身が見える・Invoice と同じ |
| ログイン | **Supabase Auth** | 自分のメールだけ |
| AI | **Anthropic** | いまと同じ（キーだけ移す） |

### やめるもの（Cloudflare）

| やめるもの | いま何に使っていたか |
|---|---|
| Workers | アプリ公開 |
| D1 | DB |
| Access / Zero Trust | 門番ログイン |
| wrangler | デプロイ・D1操作 |

### 進め方の順番（重要）

1. **先にバックアップ**（PCデータ）
2. Supabase / Vercel を用意
3. コードを付け替え（実装）
4. 新URLで動かす・データを入れる
5. **最後に Cloudflare を消す**（先に消すと戻れなくなる）

---

## 2. 始める前（データ退避）

PCの Clear Bid で入れてきた案件・プロフィールは、移行中に消えないよう必ず退避します。

### 手順

1. PCで Clear Bid を開く
2. **自分** タブを開く
3. **「バックアップをダウンロード」** を押す
4. `clear-bid-backup-YYYY-MM-DD.json` が落ちる
5. Googleドライブ / メールなどで保管（2か所あると安心）

> この JSON が「移行用の正解データ」です。なくしたら戻せません。

---

## 3. Supabase プロジェクトを作る

### なぜ？

データを置く「箱」を作ります。Clear Invoice と同じアカウントで別プロジェクトを作るのがおすすめです（混ぜない）。

### クリック順

1. ブラウザで [https://supabase.com/dashboard](https://supabase.com/dashboard) を開く
2. Clear Invoice で使っているアカウントでログイン
3. **New project** をクリック
4. 入力例:
   - **Name**: `clear-bid`
   - **Database password**: 強いパスワードを生成して **パスワードマネージャに保存**（あとからほぼ見られない）
   - **Region**: `Northeast Asia (Tokyo)` があればそれ（日本から近い）
5. **Create new project** → 1〜2分待つ

### 控える値（あとで Vercel / .env に使う）

プロジェクトができたら:

1. 左メニュー **Project Settings**（歯車）
2. **API**
3. 次をメモ:

| 名前 | どこに書いてあるか | 用途 |
|---|---|---|
| **Project URL** | `https://xxxx.supabase.co` | アプリから接続 |
| **anon public** key | `eyJ...` の長い文字 | ブラウザ用（公開してOKな設計の鍵） |
| **service_role** key | `eyJ...`（Reveal が必要） | サーバーだけ。**絶対にGitHubに上げない** |

---

## 4. 自分だけログインできるようにする

### なぜ？

インターネットに出すので、他人が入ると案件情報が漏れます。自分のメールだけ通します。

### メールログインを有効にする

1. Supabase 左メニュー **Authentication**
2. **Providers**
3. **Email** を開く
4. **Enable Email provider** が ON か確認
5. 好み:
   - 開発中は **Confirm email** を一時OFFでも可（本番はON推奨）
6. Save

### 自分のユーザーを作る

方法A（簡単）:

1. **Authentication** → **Users**
2. **Add user** → **Create new user**
3. 自分のメールとパスワードを入れる
4. Create

方法B:

1. アプリのログイン画面ができてから、そのメールでサインアップ
2. Users 一覧に自分だけいることを確認

### （推奨）他人の新規登録を止める

自分専用ツールなら:

1. **Authentication** → **Providers** → Email
2. 運用が始まったら、アプリ側で「許可メール以外は拒否」にする  
   または Dashboard で不要ユーザーを都度削除

> 実装時は「許可メール1つだけ」にするのが一番わかりやすいです。

---

## 5. テーブルを用意する

### なぜ？

いまの Clear Bid は、ざっくり次の文書を保存しています。

- `profile`（自分情報）
- `pipeline`（案件一覧）
- `stats`（集計）
- `ai_usage`（AI利用回数）

最初は **Clear Bid 用のシンプルな表1つ**（または数表）で十分です。  
（中身は JSON でも、あとで正規化してもOK）

### あなたがやること（実装前の準備）

1. Supabase 左メニュー **SQL Editor**
2. 実装PRで渡される SQL を貼って **Run**
3. 左メニュー **Table Editor** で表ができていることを確認

> 実行する SQL はリポジトリの `supabase/migrations/20260812_user_documents_rls.sql` です。中身をコピーして Run。

---

## 6. コード側の切り替え（実装済み）

アプリ側の付け替えは完了しています。

- Cloudflare Access → **Supabase Auth**（`/login`、Email/Password）
- D1 / localStorage → **Supabase `user_documents` + RLS**
- デプロイ preset → **Vercel**
- SQL ファイル: `supabase/migrations/20260812_user_documents_rls.sql`

### 環境変数（ローカル `.env`）

```bash
AI_PROVIDER=auto
ANTHROPIC_API_KEY=sk-ant-...

NUXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NUXT_SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 任意: 空なら認証済みユーザー全員OK
ALLOWED_EMAIL=you@example.com
```

---

## 7. Vercel に載せる

### なぜ？

Clear Invoice と同じ公開の箱です。GitHub 連携で `main` に push すると自動デプロイできます。

### クリック順

1. [https://vercel.com](https://vercel.com) にログイン（Invoice と同じアカウント推奨）
2. **Add New…** → **Project**
3. GitHub の `Clear-Bid`（または `clear-bid`）を **Import**
4. Framework は Nuxt 系が自動検出されなければ:
   - Build Command: `pnpm build`
   - Output: Nuxt / Nitro の既定（実装後の README に従う）
5. **Environment Variables** に次を追加（Production / Preview 両方推奨）:
   - `ANTHROPIC_API_KEY`（または `NUXT_ANTHROPIC_API_KEY` ※実装後の名前に合わせる）
   - `NUXT_PUBLIC_SUPABASE_URL`
   - `NUXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NUXT_SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_EMAIL`
6. **Deploy**

### 控えるもの

デプロイ後の URL（例: `https://clear-bid.vercel.app`）

---

## 8. PCのデータを流し込む

### 手順

1. 新しい Clear Bid（Vercel URL）を開く
2. Supabase の自分アカウントでログイン
3. **自分** → バックアップ JSON を取り込む  
   （ファイル選択、または中身貼り付け）
4. ホーム / 案件一覧に PC と同じデータが出るか確認
5. Supabase の **Table Editor** でも行が増えているか確認

---

## 9. 動作確認

- [ ] ログアウト状態だと中に入れない（またはログインを求められる）
- [ ] 自分のメールだけ入れる
- [ ] プロフィール保存がリロード後も残る
- [ ] 案件がリロード後も残る
- [ ] 別端末（スマホ）でも同じデータが見える
- [ ] 診断〜提案文（Anthropic）が動く
- [ ] Supabase ダッシュボードでデータが目視できる

ここまでOKなら、**もう Cloudflare 側は不要**です。

---

## 10. Cloudflare の消し方

> **順番厳守:** 新しい Vercel URL で一通り使えてから消す。

### 10-1. Workers アプリを消す

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) を開く
2. 左 **Workers & Pages**
3. `clear-bid`（または作った名前）をクリック
4. **Settings** → 下の方 **Delete** / **Delete Worker**
5. 名前を入力して削除

なぜ？ → 古いURLが残っていると、どっちが本番か混乱します。

### 10-2. D1 データベースを消す

1. **Workers & Pages** → **D1**
2. `clear-bid` をクリック
3. **Settings** → **Delete database**
4. 確認して削除

なぜ？ → 課金・残骸を残さないため。中身はもう使わない（バックアップJSONとSupabaseが正解）。

### 10-3. Access（門番）を消す

1. [Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) を開く
2. **Access** → **Applications**
3. `Clear Bid` のアプリを開く
4. **Delete application**（または設定の削除）

なぜ？ → Workers を消しても Access 設定だけ残ることがあるため。

### 10-4. 使っていないトークンがあれば削除

1. Cloudflare Dashboard → 右上プロフィール → **My Profile**
2. **API Tokens**
3. Clear Bid / wrangler 用に作ったトークンがあれば **Roll** または **Delete**

### 10-5. 手元（PC）の掃除

プロジェクトで:

```bash
# もう使わないローカル状態（あれば）
rm -rf .wrangler

# .env から Cloudflare 用を消す／コメントアウト
# CF_ACCESS_TEAM_DOMAIN=
# CF_ACCESS_AUD=
# AUTH_BYPASS=...
```

コード側（実装PRで実施）:

- `wrangler.jsonc` 削除
- `server/utils` の D1/Access 実装削除
- `docs/DEPLOY.md`（Cloudflare版）を Supabase/Vercel 版に更新 or 置き換え

### 10-6. 消さなくていいもの

- Cloudflare アカウント自体（他用途があれば残してOK）
- ドメインを Cloudflare に置いている場合のDNS（Clear Bid Workers と無関係なら触らない）

---

## 11. 最終チェックリスト

### 移行前

- [ ] バックアップ JSON を2か所に保存した
- [ ] Supabase プロジェクト `clear-bid` を作った
- [ ] URL / anon / service_role を控えた（service_role は秘匿）
- [ ] 自分の Auth ユーザーを作った

### 移行中

- [ ] コードが Supabase + Vercel 向けに切り替わった
- [ ] Vercel に環境変数を入れた
- [ ] デプロイURLでログインできた
- [ ] バックアップを取り込めた
- [ ] スマホでも同じデータが見えた

### 移行後（掃除）

- [ ] Cloudflare Worker 削除
- [ ] D1 削除
- [ ] Access Application 削除
- [ ] 不要 API トークン削除
- [ ] 古い Workers URL をブックマークから外した

---

## よくある質問

### Supabase 無料枠のスリープは？

しばらくアクセスがないと一時停止します。  
常用するなら実害は小さめ。気になるならあとで Pro。Clear Invoice と同じ判断でOKです。

### Clear Invoice と同じプロジェクトにしていい？

**別プロジェクト推奨。**  
混ぜると権限・バックアップ・障害の切り分けが大変になります。アカウントは同じで、プロジェクトだけ分ける。

### 今すぐ Cloudflare を消していい？

**まだダメ。** 新環境でデータ確認が終わるまで残す。

### 実装は誰がやる？

このドキュメントは「手順と消し方」です。  
コード付け替えは Cursor に「セクション6の頼み方」で依頼してください。
