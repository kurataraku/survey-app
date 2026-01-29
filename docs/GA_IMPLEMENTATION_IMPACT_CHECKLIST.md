# GA 実装 本番反映前 機能影響確認チェックリスト

Google アナリティクス（GA4）実装を本番に反映する前に、**通信制高校リアルレビュー** サイト全体の機能に影響がないことを確認するためのチェックリストです。

---

## 1. 実装の影響範囲（開発側確認済み）

### 1.1 変更ファイル

| ファイル | 役割 |
|----------|------|
| `app/layout.tsx` | ルートレイアウトに `<GoogleAnalyticsInit />` と `<GoogleAnalytics />` を追加 |
| `components/GoogleAnalyticsInit.tsx` | **サーバーコンポーネント**。`next/script` で gtag を読み込み（計測IDがないときは `null`） |
| `components/GoogleAnalytics.tsx` | **クライアントコンポーネント**。`page_view` 送信のみ。`return null` で DOM 出力なし |
| `types/gtag.d.ts` | `Window` に `gtag` / `dataLayer` の型定義を追加（既存コードへの影響なし） |

### 1.2 動作のポイント

- **計測ID（`NEXT_PUBLIC_GA_MEASUREMENT_ID`）未設定時**
  - `GoogleAnalyticsInit`: 何もレンダリングしない（`return null`）
  - `GoogleAnalytics`: `useEffect` 内で即 return。スクリプト読み込み・`setInterval` ・`gtag` 呼び出しは一切行わない  
  → **サイト機能への影響なし**

- **計測ID設定時**
  - gtag は `next/script` の `afterInteractive` で読み込み（レンダリングをブロックしない）
  - `GoogleAnalytics` は `useEffect` で `page_view` を送るのみ。`return null` のため **DOM ・レイアウトへの影響なし**
  - `/tsushin-kuchikomi/admin` 配下では `page_view` を送信しないが、gtag の読み込みは全ページで行う

- **他機能との接点**
  - `window.gtag` / `window.dataLayer` は **GA 用コンポーネント内でのみ使用**。フォーム送信・API・認証・ルーティング等には未使用
  - `usePathname()` は**参照のみ**。`Link` / `router.push` / `redirect` は使用していない

### 1.3 ビルド確認

- `npm run build` で **ビルド成功** することを確認済み（GA 実装ありの状態）

---

## 2. 本番反映前に実施する確認（推奨）

以下は、**本番デプロイ前**にローカルまたはプレビュー環境で実施することを推奨します。

### 2.1 ビルド

- [ ] `npm run build` が成功する

### 2.2 計測ID **未設定**で起動・表示確認

- [ ] `.env.local` から `NEXT_PUBLIC_GA_MEASUREMENT_ID` を削除（またはコメントアウト）
- [ ] `npm run dev` で起動し、以下が **通常どおり** 表示・動作することを確認する  
  - [ ] `http://localhost:3000/`（会社トップ）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi`（アプリトップ）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/schools`（学校一覧）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/schools/[任意のslug]`（学校詳細）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/features`（特集一覧）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/contact`（お問い合わせ）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/survey`（口コミフォーム）  
  - [ ] `http://localhost:3000/tsushin-kuchikomi/admin/login`（管理画面ログイン）

### 2.3 計測ID **設定**で起動・表示・計測確認

- [ ] `.env.local` に `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` を設定
- [ ] `npm run dev` で起動し、上記 2.2 の各 URL が **通常どおり** 表示・動作することを確認する
- [ ] DevTools → Console に **GA 関連のエラー** が出ていないことを確認する
- [ ] DevTools → Network で `gtag` または `googletagmanager` フィルタ时、該当リクエストが発生することを確認する（任意）

### 2.4 主要フロー（計測ID設定時）

- [ ] **検索**  
  - アプリトップで学校名・都道府県検索 → 結果表示 → 学校詳細へ遷移 → 問題なし
- [ ] **口コミフォーム**  
  - `/tsushin-kuchikomi/survey` で回答・送信 → 送信完了まで問題なし
- [ ] **お問い合わせ**  
  - `/tsushin-kuchikomi/contact` でフォーム送信 → 送信完了まで問題なし
- [ ] **管理画面**  
  - ログイン → 学校一覧・編集、記事一覧・編集、問い合わせ一覧 など、必要な操作が問題なくできる

### 2.5 会社トップ（`/`）

- [ ] `http://localhost:3000/`（会社トップ）が通常どおり表示され、リンク・アンカー・ボタンが期待どおり動作する

---

## 3. 本番反映時の注意

- **環境変数**  
  - Vercel の **Production** に `NEXT_PUBLIC_GA_MEASUREMENT_ID` を設定してからデプロイする。  
  - 未設定のままでも **サイトの表示・機能には影響しない**（計測のみ行われない）。

- **再デプロイ**  
  - 環境変数の追加・変更後は **Redeploy** する。

---

## 4. 問い合わせ

不明点や不具合らしき挙動があれば、開発・運営責任者に共有してください。
