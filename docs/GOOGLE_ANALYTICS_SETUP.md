# Google アナリティクス（GA4）設定・確認ガイド

このドキュメントでは、**careeressence.jp** および **通信制高校リアルレビュー**（`/tsushin-kuchikomi`）の  
Google アナリティクス連携を正しく計測するための設定と確認手順をまとめます。

---

## 1. 現状の整理

### このアプリ（survey-app）について

- **現状**: 2025年1月時点で、**Next.js アプリ内に Google アナリティクス（gtag / GA4 / GTM）の実装はありません**。
- **計測されていたとの認識について**  
  以前計測されていた場合は、次のいずれかの可能性があります。
  - **旧サイト**（STUDIO 作成の会社トップなど）に GA タグが埋め込まれていた
  - **旧ドメイン**（例: real-review.vercel.app）や別デプロイで GA を設定していた
  - **Google Search Console（GSC）** の「クリック数・表示回数」などを GA のページビューと混同している  
    → GSC は「検索結果からの流入」のみ。GA は「サイト全般のアクセス」を計測します。

**結論**: この Next.js アプリで **careeressence.jp および /tsushin-kuchikomi を正しく計測するには、GA4 の実装と設定の確認が必要**です。

---

## 2. GA4 の実装内容（コード側）

実装済みの場合は、以下が入っています。

| 項目 | 内容 |
|------|------|
| **計測ID** | 環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID`（例: `G-XXXXXXXXXX`） |
| **読み込み** | ルートレイアウトで `GoogleAnalyticsInit` が **next/script** により gtag を読み込み（会社トップ `/` と `/tsushin-kuchikomi` 配下の両方）。Network タブで `gtag` / `googletagmanager` フィルタするとリクエストを確認しやすい。 |
| **ページビュー** | `GoogleAnalytics` クライアントで、**クライアント側のページ遷移時のみ** `page_view` を送信。初期表示（フルロード）では送信しない（GTM 等の他タグと二重計測になるため）。同一 path の 3 秒以内の重複送信もガード。 |
| **除外** | `/tsushin-kuchikomi/admin` 配下では **page_view を送信しない**（管理画面のため）。gtag の読み込みは全ページで行う。 |

- 会社トップ `https://careeressence.jp/`
- アプリトップ `https://careeressence.jp/tsushin-kuchikomi`
- 学校詳細・特集など `https://careeressence.jp/tsushin-kuchikomi/...`  
→ いずれも **同一の GA4 プロパティ** で計測されます。

---

## 3. 事前準備（GA4 プロパティ・データストリーム）

1. **Google アナリティクス** にログインし、**GA4 プロパティ** を用意する。  
   - 既存の UA のみの場合は、**GA4 プロパティを新規作成** する。
2. **データストリーム** を追加する。
   - **ウェブ** を選択。
   - **ウェブサイトの URL**: `https://careeressence.jp`
   - **ストリーム名**: 例）`careeressence.jp` や `通信制高校リアルレビュー`  
3. **測定 ID**（`G-XXXXXXXXXX`）を控える。  
   → この値を `NEXT_PUBLIC_GA_MEASUREMENT_ID` に設定します。

**ポイント**:
- ドメインは **apex の `https://careeressence.jp`** に合わせる。  
- `https://www.careeressence.jp` は apex にリダイレクトしているため、ストリームは **1つ（apex）** でよい。

---

## 4. 環境変数とデプロイ

1. **Vercel** → 対象プロジェクト → **Settings** → **Environment Variables**
2. 次を追加する。

   | 名前 | 値 | 対象環境 |
   |------|-----|----------|
   | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX`（測定ID） | Production（必要なら Preview も） |

3. **保存** 後、**Redeploy** する。  
   - `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、**追加・変更のたびに再デプロイ** が必要です。

ローカルで確認する場合は、`.env.local` に同じ変数を追加し、`npm run dev` で起動します。

**本番反映前に、通信制高校リアルレビューサイト全体の機能へ影響がないか確認したい場合**  
→ **`docs/GA_IMPLEMENTATION_IMPACT_CHECKLIST.md`** のチェックリストを実施してください。

---

## 5. 動作確認チェックリスト

実装・設定後、次を順に確認してください。

### 5.1 タグが読み込まれているか

1. ブラウザで **本番サイト** を開く（例: `https://careeressence.jp/`, `https://careeressence.jp/tsushin-kuchikomi`）。
2. **DevTools** → **ネットワーク** タブを開き、**「Preserve log」と「Disable cache」にチェック** を入れてから、ページを **ハードリロード**（Ctrl+Shift+R / Cmd+Shift+R）する。
3. フィルタに `gtag` または `googletagmanager` を入力する。
4. `https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX` へのリクエストが **200** で表示されるか確認する。

**リクエストが出ない場合に確認すること**

- **この GA 実装が本番にデプロイされているか**  
  - この実装（`GoogleAnalyticsInit` / `GoogleAnalytics`）を含むコミットが main にマージされ、Vercel の **Production** にデプロイされているか確認する。
- **環境変数**  
  - Vercel → **Settings** → **Environment Variables** で `NEXT_PUBLIC_GA_MEASUREMENT_ID` が **Production**（少なくとも本番）に設定されているか。
- **再デプロイ**  
  - 環境変数を追加・変更したあと、**Redeploy** しているか。`NEXT_PUBLIC_*` はビルド時に埋め込まれるため、変更後は必ず再デプロイが必要。
- **計測対象ページか**  
  - 確認している URL が `/tsushin-kuchikomi/admin` 配下でないか。管理画面では gtag を読み込まない実装にはしていないが、page_view は送信していない。

### 5.2 リアルタイムで計測されているか

1. **GA4** → **レポート** → **リアルタイム** を開く。
2. 別タブで `https://careeressence.jp/` や `https://careeressence.jp/tsushin-kuchikomi` を開き、数秒待つ。
3. リアルタイムに **アクティブユーザー** や **ページビュー** が増えるか確認する。

### 5.3 ページ別の URL が正しいか

1. **リアルタイム** の **ビューページ** などで、計測されている URL を確認する。
2. 次のようなパスが含まれているか確認する。
   - `/` … 会社トップ
   - `/tsushin-kuchikomi` … アプリトップ
   - `/tsushin-kuchikomi/schools/○○` … 学校詳細
   - `/tsushin-kuchikomi/features/○○` … 特集記事  

旧ドメイン（`real-review.vercel.app`）や `/admin` 配下が **意図せず多くなっていないか** もあわせて確認するとよいです。

### 5.4 DebugView でイベント確認（任意）

1. ブラウザに **Google アナリティクス デバッガー** 拡張機能を入れ、有効化する。
2. 対象ページを開き、**GA4** → **管理** → **DebugView** を開く。
3. `page_view` などが送信されているか確認する。

### 5.5 管理画面は計測されていないか

1. `https://careeressence.jp/tsushin-kuchikomi/admin` にログインして操作する。
2. **リアルタイム** で、`/admin` を含む URL の **ページビューが増えない** ことを確認する。  
   → 実装では `/admin` 配下は送信対象外にしています。

---

## 6. 運用時の注意

- **測定 ID の変更**: `NEXT_PUBLIC_GA_MEASUREMENT_ID` を変えたら、**必ず再デプロイ** してください。
- **二重計測対策**: 当実装は **初期表示（フルロード）では `page_view` を送らず、クライアント側のページ遷移時のみ** 送信します。初期は GTM 等の他タグに任せ、表示回数が 2 ずつ増える事象を防いでいます。他タグがない場合、直接 URL を開いたときの初期ロードは当実装では計測されません。
- **データの反映**: リアルタイムは即時、通常のレポートは **24〜48 時間程度** かかることがあります。
- **アドブロック**: ユーザーがブロックしていると計測されません。これは GA の仕様です。
- **GSC と GA の違い**:  
  - **GSC**: 検索結果の表示回数・クリック数。  
  - **GA**: サイトへの訪問・ページビュー・セッションなど。  
  どちらも運用に有用なので、必要に応じて両方確認してください。

---

## 7. トラブルシューティング

| 状況 | 確認すること |
|------|------------------|
| 計測されない | 1. `NEXT_PUBLIC_GA_MEASUREMENT_ID` が本番環境に設定されているか<br>2. 設定変更後に再デプロイしたか<br>3. データストリームの URL が `https://careeressence.jp` か<br>4. アドブロックや Do Not Track などでブロックされていないか |
| 会社トップだけ計測されない | ルートレイアウトで gtag を読み込んでいるか。`/` と `/tsushin-kuchikomi` は同一アプリのため、通常はどちらも計測されます。 |
| 管理画面が計測される | 実装で `/admin` は除外しているはず。除外ロジックや `page_path` の条件を再確認する。 |
| 表示回数が 2 ずつ増える | 当実装は初期表示では送信せず遷移時のみ送るため軽減済み。まだ 2 件ずつになる場合は、GTM 等の別 GA4 タグが同じプロパティに送っていないか確認する。 |
| 旧 URL のデータが混在する | 旧ドメイン用のストリームやプロパティを分けている場合は、プロパティ／ストリームを切り替えて確認する。 |

---

## 8. 参照

- [GA4 ウェブ データストリーム](https://support.google.com/analytics/answer/9304153)
- [gtag.js のセットアップ](https://develop.google.com/analytics/devguides/collection/ga4)
- ドメイン・リダイレクト・SEO 全般: `DOMAIN_MIGRATION_SEO_CHECKLIST.md`

以上で、GA4 の設定と確認の流れは一通りです。不明点があれば開発・運用責任者に相談してください。
