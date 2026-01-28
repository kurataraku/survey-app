# ドメイン移行：ブラウザで行う作業手順

お名前.com と Vercel のブラウザ上で、**この順番**に作業してください。

---

## 現在の構成（basePath 対応済み）

- **このサイトのトップ**: `https://careeressence.jp/tsushin-kuchikomi`
- **ルート `/`**: 一時的に `https://careeressence.jp/tsushin-kuchikomi` へ **302 リダイレクト**
- 会社トップ（`/`）は後で別フロントに差し替える予定。その時点で `/` のリダイレクトをやめ、会社トップを表示する。

---

## このあとやること（デプロイ・会社トップ差し替え）を丁寧に

「デプロイ」と「会社トップの差し替え」について、**何を・いつ・どうやるか**を順に書きます。

---

### その1：デプロイして、リダイレクトと表示を確認する

**「デプロイ」** = いまのコード（basePath やリダイレクトの変更を含む）を Vercel に送り、本番サイトに反映することです。

#### 1. デプロイのやり方（どちらか一方でOK）

**パターンA：Git を使っている場合（推奨）**

1. いまの変更を **コミット** する。  
   - 例：`git add .` → `git commit -m "basePath /tsushin-kuchikomi 対応"`  
2. **main**（または Vercel の本番ブランチ）に **プッシュ** する。  
   - 例：`git push origin main`  
3. Vercel が自動でビルド・デプロイを開始する。  
4. ダッシュボードの **Deployments** で、**Ready** になるまで待つ。

**パターンB：Vercel の画面から手動で再デプロイする場合**

1. **https://vercel.com** にログインする。  
2. 対象 **プロジェクト** を開く。  
3. 上タブの **Deployments** をクリック。  
4. 一番上（最新）のデプロイの行の、右端の **︙**（縦三点）をクリック。  
5. **Redeploy** を選ぶ。  
6. **Redeploy** ボタンで確定。  
7. 同じデプロイの **Status** が **Building** → **Ready** になるまで待つ。

※ 手動 Redeploy のときは、**いま Vercel に接続されている Git の最新コミット**がデプロイされます。  
ローカルの変更を反映したい場合は、先に **Git に push** してから Redeploy してください。

#### 2. デプロイ後の確認（やることの具体例）

デプロイが **Ready** になったあと、次を **ブラウザで** 確認します。  
**シークレットウィンドウ**（Chrome: Ctrl+Shift+N）を使うと、キャッシュの影響を減らせます。

| やること | どうやるか | 期待する結果 |
|---------|------------|--------------|
| **① リダイレクトの確認** | アドレス欄に `https://careeressence.jp/` と入力して Enter | 自動で `https://careeressence.jp/tsushin-kuchikomi` に飛ぶ（URL が変わる） |
| **② トップの表示確認** | `https://careeressence.jp/tsushin-kuchikomi` を開く | 「通信制高校リアルレビュー」のトップが表示される |
| **③ 学校一覧の確認** | `https://careeressence.jp/tsushin-kuchikomi/schools` を開く | 学校一覧ページが表示される |

- ① ができていれば **「`/` → `/tsushin-kuchikomi` のリダイレクト」** はOKです。  
- ②・③ ができていれば **「`/tsushin-kuchikomi` の表示」** はOKです。

#### 3. うまくいかないとき

- **① でリダイレクトしない**  
  - デプロイが **Ready** になっているか確認する。  
  - シークレットウィンドウで開き直す。  
  - しばらく待ってから再度試す（CDN の反映に時間がかかることがある）。  
- **②・③ で 404 になる**  
  - 下記 **「②・③ が 404 のときの切り分け」** を順に試す。  
- **別のサイト（例：STUDIO の会社トップ）が見える**  
  - `careeressence.jp` の DNS が、**Vercel 用の A レコード**を向いているか確認する。  
  - 以前別サーバー向けだった場合、DNS の反映に時間がかかることがある。

---

#### ②・③ が 404 のときの切り分け

**原因の多くは「`careeressence.jp` がこのアプリ（survey-app）ではなく、別のサイトを向いている」です。** 次の **Step A → B → C** の順で確認してください。

---

**Step A. Vercel のデフォルト URL で開いてみる**

1. Vercel で **このプロジェクト**（survey-app / real-review など）を開く。  
2. **Deployments** タブで、最新の **Ready** になっているデプロイをクリック。  
3. 表示される **ドメイン** を確認する。  
   - 例：`https://real-review.vercel.app` や `https://survey-app-xxxx.vercel.app`  
4. その **Vercel の URL** に、続けて **`/tsushin-kuchikomi`** を付けて開く。  
   - 例：`https://real-review.vercel.app/tsushin-kuchikomi`  
5. 結果を確認する。  

| 結果 | 意味 | 次にやること |
|------|------|--------------|
| **トップが表示される** | アプリ自体は動いている。`careeressence.jp` の向き先 or 紐づきが疑わしい。 | **Step B** へ。 |
| **404 のまま** | このプロジェクトのデプロイでも 404。basePath やビルドの可能性。 | **Step C** へ。 |

---

**Step B. `careeressence.jp` が「このプロジェクト」に紐づいているか確認する**

1. Vercel で **同じプロジェクト**（survey-app）の **Settings** → 左メニュー **Domains** を開く。  
2. 一覧に **`careeressence.jp`** が **このプロジェクト** に追加されているか確認する。  
3. 結果に応じて対応する。  

- **`careeressence.jp` が一覧にない**  
  - **Add** で `careeressence.jp` と `www.careeressence.jp` を追加する。  
  - お名前.com の DNS（A / CNAME）を、Vercel の Domains 画面の指示どおりに設定する。  
  - DNS 反映後、再度 ②・③ を確認する。  

- **`careeressence.jp` が、STUDIO 用など「別の Vercel プロジェクト」に付いている**  
  - 1 つのドメインは **1 つの Vercel プロジェクト** にしか付けられません。  
  - いま `careeressence.jp` が付いているのが **STUDIO 用プロジェクト** だと、  
    `careeressence.jp/tsushin-kuchikomi` はそちらに飛び、こちらのアプリには来ません → 404 になりやすい。  
  - **このアプリ（survey-app）で `/tsushin-kuchikomi` を表示したい** 場合：  
    - **STUDIO 用プロジェクト** の Domains から `careeressence.jp`（と `www`）を **削除** し、  
    - **survey-app** の Domains で `careeressence.jp`（と `www`）を **追加** する。  
  - お名前.com の DNS（A / CNAME）は **Vercel 用の値のまま** でよく、**紐づく Vercel プロジェクトだけ** を変える。  

- **`careeressence.jp` はこのプロジェクトにだけ付いている**  
  - **Step B は問題なさそう**。  
  - DNS の向き先（お名前.com の A / CNAME）が、**このプロジェクトの Vercel 用** になっているか再確認する。  
  - 変更直後なら、数分〜数時間おいてから再度 ②・③ を試す。  

---

**Step C. Vercel の URL でも 404 のとき（アプリ側の確認）**

1. **Deployments** の最新が **Ready** か、もう一度確認する。  
2. そのデプロイの **Building** ログを開き、**エラー** が出ていないか確認する。  
3. **Settings** → **Redirects**（または **Domains** 近くのリダイレクト設定）で、  
   - **`/tsushin-kuchikomi`** や **`/tsushin-kuchikomi/*`** を別の先に飛ばす設定になっていないか確認する。  
   - あれば **削除** または **無効化** する。  
4. コードで **basePath** が `/tsushin-kuchikomi` になっているか確認する。  
   - `next.config.ts` の `basePath` と `lib/base-path.ts` の `BASE_PATH`。  
5. **middleware のリダイレクト不具合** を修正したうえで、**再デプロイ** する（下記「修正済み：middleware のリダイレクト」参照）。  
6. **vercel.app で直接確認する**（リダイレクトを一時オフにする）  
   - **Settings** → **Environment Variables** で **Add**。  
   - **Key**: `SKIP_VERCEL_APP_REDIRECT`  
   - **Value**: `1`  
   - **Environment**: Production にチェック → **Save**。  
   - **Deployments** から **Redeploy** する。  
   - `https://〇〇.vercel.app/tsushin-kuchikomi` を開く。  
     - **トップが表示されれば** アプリは問題なし。`careeressence.jp` の紐づき・DNS を **Step B** で再確認。  
     - 確認後、**Environment Variables** で `SKIP_VERCEL_APP_REDIRECT` を **削除** し、再度 **Redeploy** する（vercel.app → apex リダイレクトを元に戻す）。  

---

**修正済み（basePath → rewrites へ変更）**

**basePath** 運用で 404 が続いたため、**basePath をやめ、`rewrites` で `/tsushin-kuchikomi` を `/` にマッピングする方式**に変更しました。

- **next.config**: `basePath` 削除。`rewrites` で  
  `/tsushin-kuchikomi` → `/`、`/tsushin-kuchikomi/:path*` → `/:path*`、  
  `/tsushin-kuchikomi/api/:path*` → `/api/:path*` を設定。
- **リダイレクト**: `/` → `/tsushin-kuchikomi`（一時 302）は従来どおり。
- **Link・router・fetch**: 表示用パスは `appPath()`、API 用は `apiPath()` で統一。
- **middleware**: `/tsushin-kuchikomi/admin` 配下の保護・リダイレクト先を rewrites 前提に変更。

この状態で **再デプロイ** してから、②・③ を再確認してください。

---

**ここまでやっても 404 が続く場合**

- **Vercel のデプロイログ**（Build Logs）の最後の方にエラーが出ていないか。  
- **`npm run build`** をローカルで実行し、**ビルドが通るか**。  
- 使用している **Next.js のバージョン**（`package.json`）を共有してもらえれば、basePath 周りの互換も確認できる。  

---

### その2：会社トップの差し替え（あとでやること）

**「会社トップの差し替え」** =  
いまは **`https://careeressence.jp/`** にアクセスすると **このサイト（通信制高校リアルレビュー）のトップ** に飛ぶようになっているが、  
のちに **`/` では会社のトップページ（例：キャリエッセンスの紹介など）を表示する** ように変える、という意味です。

#### いまの状態（差し替え前）

- **`/`** → 302 リダイレクトで **`/tsushin-kuchikomi`** に飛ぶ。  
- つまり **`/`** では、実質「通信制高校リアルレビュー」のトップが表示されている。

#### 差し替え後のイメージ

- **`/`** → リダイレクトせず、**会社のトップページ**（別デザイン・別内容）を表示する。  
- **`/tsushin-kuchikomi`** → これまでどおり「通信制高校リアルレビュー」のトップ。

#### いつやるか

- **会社トップのページ（デザイン・文言・リンクなど）が用意できたあと**で問題ありません。  
- いまは **デプロイとリダイレクト・表示の確認** までで十分です。

#### やるときに変更するもの（概要）

1. **`next.config.ts` のリダイレクト**  
   - いま：**`/` → `/tsushin-kuchikomi`** の 302 リダイレクトがある。  
   - やること：このリダイレクトを **削除** する。

2. **`/` の表示内容**  
   - いま：`/` に来るとリダイレクトされるだけなので、**`/` 用のページはない**。  
   - やること：**`/` 用のページ（会社トップ）** を用意する。  
     - 例：`app/page.tsx` を **会社トップ用** に差し替える、  
       または `app/(company)/page.tsx` のような **別ルート** で会社トップを作り、`/` で表示する。

3. **basePath はそのまま**  
   - **`/tsushin-kuchikomi`** は、basePath のまま運用します。  
   - 会社トップは **basePath の外**（= ルート `/`）に置く、というイメージです。

#### 具体例（next.config の変更だけ先に知りたい場合）

**変更前（いま）：**

```ts
async redirects() {
  return [{ source: "/", destination: "/tsushin-kuchikomi", permanent: false }];
}
```

**変更後（会社トップを `/` に出すとき）：**

- **`redirects`** の中の **`{ source: "/", destination: "/tsushin-kuchikomi", ... }`** のルールを **削除** する。  
  - ほかにリダイレクトがなければ、`redirects()` は `return [];` のように空でよい。
- あわせて、**`/`** で表示する **会社トップ用のページ** を用意する（別サービスでも、このアプリ内でも、構成に合わせて）。

ここまでやれば、「`/` = 会社トップ」「`/tsushin-kuchikomi` = このサイトのトップ」という構成に切り替えられます。

**補足**  
いまは **basePath** でアプリ全体が `/tsushin-kuchikomi` 配下にあります。  
`/` は「リダイレクト」でだけ扱っていて、**このアプリでは `/` 用のページは持っていません**。  
会社トップを `/` に出すときは、

- この Next.js プロジェクトの外に会社トップ用のサービス（別サイト・STUDIO など）を用意し、**Vercel や DNS で `/` をそちら向けにする**、  
    
または

- **basePath をやめる**など、構成を変えて、このアプリ内で `/` 用のルートを追加する  

のどちらか、または別のやり方になることがあります。  
「リダイレクトを外して `/` に何かを表示する」という**目的**は上記のとおりで、**具体的な実装**は会社トップをどう作るか（同じリポジトリか、別サービスか）に合わせて決めれば大丈夫です。

---

## 事前に用意するもの

- お名前.com のログイン情報
- Vercel のログイン情報（プロジェクトのオーナー or 権限あり）
- メモ用（Vercel に表示される DNS の値を書き写すため）

---

## 第1段階：Vercel で準備する

### Step 1-1. 環境変数を設定する

1. ブラウザで **https://vercel.com** を開き、ログインする。
2. 対象の **プロジェクト**（survey-app / 通信制高校リアルレビュー）をクリック。
3. 上部タブの **Settings** をクリック。
4. 左メニューで **Environment Variables** をクリック。
5. 一覧に `NEXT_PUBLIC_SITE_URL` があるか確認する。
   - **ある場合**  
     - 右端の **…** → **Edit** をクリック。  
     - **Value** を `https://careeressence.jp` に変更して **Save**。
   - **ない場合**  
     - **Add New** をクリック。  
     - **Key**: `NEXT_PUBLIC_SITE_URL`  
     - **Value**: `https://careeressence.jp`（末尾スラッシュなし）  
     - **Environment**: Production（と Preview / Development が必要ならチェック）  
     - **Save** をクリック。
6. 本番用に **再デプロイ**する。  
   - **Deployments** タブ → 最新デプロイの **…** → **Redeploy**。

---

### Step 1-2. カスタムドメインを追加する

1. 同じプロジェクトの **Settings** → 左メニュー **Domains** をクリック。
2. **Add**（または **Add Domain**）をクリック。
3. 入力欄に `careeressence.jp` と入力し、**Add** をクリック。
4. 続けて **Add** を再度クリックし、今度は `www.careeressence.jp` を入力して **Add**。
5. **追加直後は、両方とも「Invalid Configuration」で問題ありません。**  
   お名前.com で DNS をまだ設定していないためです。Step 2 で DNS を設定し、反映されれば「Valid Configuration」に変わります。

---

### Step 1-2b. リダイレクト向きを確認・修正する（重要）

**やること**: 正規URL は **apex（careeressence.jp）** に統一し、**www → apex** にだけリダイレクトする必要があります。  
**apex → www と www → apex の両方を設定するとリダイレクトループになる**ので、必ず片方だけにします。

1. **Domains** 画面で、一覧の表示を確認する。
2. **「careeressence.jp → 307 www.careeressence.jp」** のように、**apex が www へリダイレクト**している場合は **誤り** です。修正する。
3. **www 側の修正**
   - `www.careeressence.jp` の行の **Edit** をクリック。
   - **Redirect to Another Domain** を選び、**307 Temporary Redirect**、行き先 **`careeressence.jp`** を指定する。
   - **Save** で保存する。
4. **apex 側の修正（ここを忘れやすい）**
   - `careeressence.jp`（apex）の行の **Edit** をクリック。
   - **Redirect to Another Domain** は選ばない。**Production に接続**（「Connect to an environment」で **Production** を選択）する。  
     → apex でサイトをそのまま表示し、リダイレクトは行わない。
   - **Save** で保存する。
5. 正しい状態の目安
   - **careeressence.jp**: リダイレクトなし・Production でサイト表示
   - **www.careeressence.jp**: **307 で careeressence.jp へリダイレクト**

これで、本アプリの middleware（www / vercel.app → apex）と齟齬なく動きます。

---

### Step 1-3. Vercel に表示される DNS 設定をメモする

1. **Domains** 画面のまま、`careeressence.jp` の行をクリックして詳細を開く。
2. 画面に **「DNS レコードを設定してください」** のような案内と、**A レコード**や **TXT レコード**の例が表示されます。
   - **A レコード**  
     - ホスト: `@` または空  
     - 値: `76.76.21.21` のような IP（表示どおりをメモ）
   - **TXT レコード**（表示されている場合）  
     - ホスト名と、長い文字列の値  
     - 表示されているとおりすべてメモする。
3. 同様に `www.careeressence.jp` の行を開く。
4. **CNAME レコード**の例が表示されます。
   - ホスト: `www`  
   - 値: `cname.vercel-dns.com` など（表示されているドメインをそのままメモ）
5. **TXT レコード**が `www` 用にも出ている場合は、そちらもメモする。
6. メモした内容は、次の「お名前.com」の作業で使います。  
   **Vercel の表示が優先**です。`DNS_SETUP.md` の例と違う場合は、Vercel の指示に従ってください。

---

## 第2段階：お名前.com で DNS を設定する

### Step 2-1. 現在の DNS を確認する（メール用は触らない）

1. ブラウザで **https://www.onamae.com** を開き、ログインする。
2. **ドメイン** メニューから **ドメイン一覧**（または **ご利用中のドメイン**）を開く。
3. **careeressence.jp** を選択する。
4. **DNS 設定** / **DNS レコード設定** / **DNS 設定・転送設定** といったメニューを開く。
5. 一覧で次を確認する。
   - **MX**（メールサーバー）  
     → **削除・変更しない**
   - **TXT** で **SPF** や **DKIM** などメール用  
     → **削除・変更しない**
6. **A** や **CNAME** で、  
   - ホスト `@`（または `careeressence.jp`）  
   - ホスト `www`  
   に既存レコードがあれば、**これから Vercel 用の値に差し替える**と理解しておく。  
   メール用（MX / SPF / DKIM）は残したまま、**Web 用の A・CNAME・TXT だけ**を追加・変更する。

---

### Step 2-2. apex（careeressence.jp）用の A レコードを設定する

1. DNS 設定画面で **レコードを追加** または **追加** をクリック。
2. **タイプ**で **A** を選択。
3. **ホスト名**（または **名前**）  
   - `@` または `careeressence.jp` と入力（お名前.com の画面の指定に合わせる）。
4. **値**（または **内容** / **レコード値**）  
   - Step 1-3 でメモした **A レコードの IP** を入力（例: `76.76.21.21`）。
5. **TTL** はデフォルトのまま（または 60〜3600）でよい。
6. **追加** / **登録** をクリック。
7. もともと `@` 用の **A レコード**が別の IP で存在する場合は、  
   - そのレコードを **編集** して、値を Vercel 用の IP に書き換えるか、  
   - 重複しないように **削除** してから、上記の新規 A を追加する。

---

### Step 2-3. www（www.careeressence.jp）用の CNAME レコードを設定する

1. 再度 **レコードを追加** / **追加** をクリック。
2. **タイプ**で **CNAME** を選択。
3. **ホスト名**（または **名前**）  
   - `www` と入力。
4. **値**（または **内容** / **レコード値**）  
   - Step 1-3 でメモした **CNAME のリンク先**（例: `cname.vercel-dns.com`）を入力。  
     **必ず Vercel の Domains 画面に表示されている値を使う。**
5. **TTL** はデフォルトのままでよい。
6. **追加** / **登録** をクリック。
7. もともと `www` 用の **A レコード**や **CNAME** が別の値で存在する場合は、  
   - **編集** して Vercel 用に差し替えるか、**削除** してから上記の CNAME を追加する。

---

### Step 2-4. TXT レコード（Vercel が要求している場合だけ）

1. Vercel の **Domains** 画面で、`careeressence.jp` または `www.careeressence.jp` に  
   **「TXT レコードを追加してください」** と出ている場合のみ行う。
2. お名前.com の DNS 設定で **レコードを追加** → **タイプ**: **TXT**。
3. **ホスト名**・**値**を、**Vercel に表示されているとおり**に入力する。  
   - ホストが `_vercel` や `@` など、Vercel ごとに異なるので、必ず Vercel の指示に合わせる。
4. **追加** / **登録** をクリック。
5. 複数種類の TXT を求められている場合は、それぞれ追加する。  
   **メール用の SPF / DKIM の TXT は変更・削除しない。**

---

### Step 2-5. 保存・反映の確認

1. お名前.com の DNS 設定画面で **保存** や **設定する** をクリックし、変更を確定する。
2. DNS の反映には **数分〜最大 24〜48 時間**かかることがある。
3. 確認用に **https://www.whatsmydns.net** を開き、  
   - `careeressence.jp` の **A レコード**  
   - `www.careeressence.jp` の **CNAME レコード**  
   が、Vercel 用の値になっているか確認する。

---

## 第3段階：Vercel でドメインを確認する

### Step 3-1. ドメインの状態を確認する

1. Vercel のプロジェクト → **Settings** → **Domains** を開く。
2. `careeressence.jp` と `www.careeressence.jp` の **Status** を確認する。
   - **Valid Configuration** など「有効」と出ていれば OK。
   - **Invalid Configuration** のままなら、  
     - お名前.com の A / CNAME / TXT が、Vercel の指示どおりか再確認する。  
     - 反映待ちの場合は、しばらく時間をおいてから再度 **Refresh** や **Verify** をクリックする。
3. SSL 証明書は、DNS が正しく向いたあと **数分〜数十分**で Vercel が自動発行する。  
   証明書エラーと表示される場合は、少し待ってから再度アクセスする。

---

### Step 3-2. ブラウザで動作確認する

1. **シークレットウィンドウ**（またはプライベートブラウズ）で、キャッシュの影響を避ける。
2. 次の URL を順に開く。  
   - `https://careeressence.jp`  
   - `https://www.careeressence.jp`  
   - `https://careeressence.jp/tsushin-kuchikomi`（このサイトのトップ）  
   - `https://careeressence.jp/tsushin-kuchikomi/schools`  
3. 確認したいこと。  
   - **`https://careeressence.jp`** にアクセスすると、**`https://careeressence.jp/tsushin-kuchikomi`** へ自動で飛ぶ（リダイレクト）。  
   - **`https://www.careeressence.jp`** にアクセスすると、**`https://careeressence.jp`**（apex）へリダイレクトされ、その結果 **`/tsushin-kuchikomi`** が表示される。  
   - **`https://careeressence.jp/tsushin-kuchikomi`** で「通信制高校リアルレビュー」のトップが表示される。  
   - 証明書エラーが出ず、鍵マーク付きで表示される。

---

## チェックリスト（作業前・作業後の確認用）

- [ ] **Vercel**  
  - [ ] `NEXT_PUBLIC_SITE_URL` = `https://careeressence.jp` に設定した  
  - [ ] `careeressence.jp` と `www.careeressence.jp` を Domains に追加した  
  - [ ] **リダイレクト向き**: www → apex。かつ **apex はリダイレクトなしで Production 接続**（両方 Edit で確認した）  
  - [ ] A / CNAME / TXT の値をメモした  
  - [ ] 本番を再デプロイした（環境変数を追加・変更した場合）
- [ ] **お名前.com**  
  - [ ] 現在の DNS を確認し、MX / SPF / DKIM は触っていない  
  - [ ] apex 用 **A**（`@` → Vercel の IP）を設定した  
  - [ ] www 用 **CNAME**（`www` → Vercel の CNAME 先）を設定した  
  - [ ] Vercel が要求している **TXT** があれば追加した  
  - [ ] 設定を保存した
- [ ] **確認**  
  - [ ] whatsmydns で A / CNAME の反映を確認した  
  - [ ] Vercel Domains で **Valid Configuration** になっている  
  - [ ] ブラウザで `https://careeressence.jp`・`www`・旧URL の動作を確認した  
  - [ ] **sitemap / robots** の確認（下記「sitemap / robots の確認」を実施した）

---

## sitemap / robots の確認

SEO まわりを含めて安心するため、以下で **意図どおり表示されるか** だけ確認する。

### 1. 確認する URL

| 対象 | URL |
|------|-----|
| robots.txt | `https://careeressence.jp/tsushin-kuchikomi/robots.txt` |
| sitemap.xml | `https://careeressence.jp/tsushin-kuchikomi/sitemap.xml` |

### 2. 手順（ブラウザ）

1. **robots.txt**
   - 上記 URL をそのままアドレスバーに入力してアクセスする。
   - 期待される内容：
     - `User-Agent: *`
     - `Allow: /`
     - `Disallow: /tsushin-kuchikomi/admin/`
     - `Disallow: /tsushin-kuchikomi/api/`
     - `Disallow: /tsushin-kuchikomi/export`
     - `Disallow: /tsushin-kuchikomi/survey`
     - `Sitemap: https://careeressence.jp/tsushin-kuchikomi/sitemap.xml`
   - 404 や HTML ページではなく、**テキストとして** 上記のような内容が表示されれば OK。

2. **sitemap.xml**
   - 上記 URL をそのままアドレスバーに入力してアクセスする。
   - 期待される内容：
     - **XML** のサイトマップ（`<urlset>` など）。
     - 各 `<loc>` は `https://careeressence.jp/tsushin-kuchikomi` または  
       `https://careeressence.jp/tsushin-kuchikomi/...` で始まっている。
     - 例: `/`、`/schools`、`/reviews`、`/schools/[slug]`、`/reviews/[id]`、`/features/[slug]` など。
   - 404 や 500 エラーではなく、**XML が表示され、URL が apex + `/tsushin-kuchikomi` 配下** になっていれば OK。

### 3. 補足

- **ローカル確認**（`npm run dev` 起動後）  
  - `http://localhost:3000/tsushin-kuchikomi/robots.txt`  
  - `http://localhost:3000/tsushin-kuchikomi/sitemap.xml`  
  でも同様にアクセスして確認できる。  
  - ローカルでは `NEXT_PUBLIC_SITE_URL` が未設定だと `baseUrl` が `https://example.com/tsushin-kuchikomi` になるため、**本番デプロイ後の URL 確認** がより重要。

- **sitemap.xml が 500 になる場合**  
  - Supabase 接続・環境変数（`NEXT_PUBLIC_SUPABASE_URL` など）を確認する。  
  - Vercel の **Functions / Logs** でエラー内容を確認する。

---

## うまくいかないとき

- **ずっと Invalid Configuration**  
  → お名前.com の A / CNAME / TXT が、Vercel の **Domains 画面に表示されている内容と完全に一致しているか** 再確認する。  
  → ホスト名の表記（`@` / `www` / 末尾のドメインの有無など）も、お名前.com と Vercel で揃える。
- **apex が www にリダイレクトされてしまう／ループする**  
  → **Step 1-2b** のとおり、(1) `www.careeressence.jp` の **Edit** で 307 → **apex** にし、(2) **`careeressence.jp`（apex）の Edit** でリダイレクトを外し、**Production に接続**にする。
- **www がリダイレクトされない**  
  → 本アプリの middleware が効いている前提。Vercel に最新コードがデプロイされているか、**Redeploy** を確認する。
- **メールが届かなくなった**  
  → MX / SPF / DKIM を変更していないか確認する。変更した場合は、元の値に戻す。
- **詳細**  
  → `DNS_SETUP.md` および [Vercel ドメインのトラブルシューティング](https://vercel.com/docs/domains/troubleshooting) を参照する。
