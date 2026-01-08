# SEO実装まとめ

## 実装日
2026年1月8日

## 実装内容

### 1. メタ情報の最適化

#### ルートレイアウト（`app/layout.tsx`）
- デフォルトタイトル: 「通信制高校リアルレビュー | 口コミ・評判で選ぶ通信制高校」
- タイトルテンプレート: `%s | 通信制高校リアルレビュー`
- 説明文: 主要キーワードを含む最適化された説明
- キーワード: 「通信制」「通信制高校」「通信制 口コミ」「通信制高校 口コミ」など
- OGP設定: Open Graph と Twitter Card の設定
- robots設定: インデックス許可、Googlebot設定

#### 各ページのメタ情報

**静的ページ（layout.tsxで設定）:**
- `/schools` - 学校一覧ページ
- `/reviews` - 口コミ一覧ページ
- `/rankings` - ランキング一覧ページ
- `/features` - 特集記事一覧ページ

**動的ページ（generateMetadata関数で設定）:**
- `/schools/[slug]` - 学校詳細ページ（`{学校名} 口コミ・評判`）
- `/reviews/[id]` - 口コミ詳細ページ（`{学校名} 口コミ`）
- `/features/[slug]` - 特集記事詳細ページ
- `/rankings/[type]` - ランキング詳細ページ

### 2. 構造化データ（JSON-LD）

#### サイト全体（`app/layout.tsx`）
- **Organization**: サイト運営者情報
- **WebSite**: サイト情報と検索機能

#### 各ページの構造化データ
- **学校詳細ページ**: `EducationalOrganization` スキーマ（評価情報含む）
- **口コミ詳細ページ**: `Review` スキーマ
- **特集記事詳細ページ**: `Article` スキーマ

### 3. サイトマップ（`app/sitemap.ts`）

自動生成されるサイトマップに以下を含む：
- 静的ページ（トップ、学校一覧、口コミ一覧、ランキング、特集、その他）
- 動的ページ：
  - 学校詳細ページ（status='active'の学校のみ）
  - 口コミ詳細ページ（最新1000件、is_public=trueのみ）
  - 特集記事詳細ページ（is_published=trueのみ）

各ページの優先度と更新頻度を設定：
- トップページ: priority 1.0, changeFrequency 'daily'
- 学校詳細: priority 0.9, changeFrequency 'weekly'
- 口コミ詳細: priority 0.7, changeFrequency 'monthly'

### 4. robots.txt（`app/robots.ts`）

- すべてのクローラーに許可
- 除外パス:
  - `/admin/` - 管理画面
  - `/api/` - APIエンドポイント
  - `/export` - データエクスポート
  - `/survey` - フォームページ（インデックス不要）
- サイトマップのURLを指定

### 5. 内部リンクの最適化

既存の内部リンクを確認：
- フッターリンク: 適切なアンカーテキストが設定済み
- 学校カード: 学校名へのリンク
- 口コミカード: 学校名・口コミ詳細へのリンク
- 特集記事カード: 記事タイトルへのリンク

**注意**: UIや機能は一切変更していません。既存のリンク構造をそのまま活用しています。

## 環境変数

以下の環境変数が必要です（既存の設定を確認してください）：

```env
NEXT_PUBLIC_SITE_URL=https://yourdomain.com  # サイトマップとOGPで使用
```

## 主要キーワード対応

実装したキーワード：
- ✅ 「通信制」- ルートレイアウト、各ページのキーワードに含む
- ✅ 「通信制高校」- タイトル、説明文、キーワードに含む
- ✅ 「通信制 口コミ」- 各ページのキーワードに含む
- ✅ 「{学校名} 口コミ」- 学校詳細ページのタイトルとキーワードに含む

## 実装ファイル一覧

### 新規作成
- `app/sitemap.ts` - サイトマップ生成
- `app/robots.ts` - robots.txt生成
- `components/StructuredData.tsx` - 構造化データコンポーネント
- `app/schools/layout.tsx` - 学校一覧ページのメタ情報
- `app/schools/[slug]/layout.tsx` - 学校詳細ページのメタ情報と構造化データ
- `app/reviews/layout.tsx` - 口コミ一覧ページのメタ情報
- `app/reviews/[id]/layout.tsx` - 口コミ詳細ページのメタ情報と構造化データ
- `app/rankings/layout.tsx` - ランキング一覧ページのメタ情報
- `app/rankings/[type]/layout.tsx` - ランキング詳細ページのメタ情報
- `app/features/layout.tsx` - 特集記事一覧ページのメタ情報
- `app/features/[slug]/layout.tsx` - 特集記事詳細ページのメタ情報と構造化データ

### 変更
- `app/layout.tsx` - ルートレイアウトのメタ情報最適化、構造化データ追加

## 確認事項

### サイトマップの確認
1. 開発サーバーを起動
2. `http://localhost:3000/sitemap.xml` にアクセス
3. サイトマップが正しく生成されているか確認

### robots.txtの確認
1. `http://localhost:3000/robots.txt` にアクセス
2. 正しい設定が表示されているか確認

### メタ情報の確認
1. 各ページのソースコードを確認（右クリック → ページのソースを表示）
2. `<title>` と `<meta name="description">` が正しく設定されているか確認
3. 構造化データ（`<script type="application/ld+json">`）が含まれているか確認

### 検索エンジン最適化
- Google Search Consoleにサイトマップを登録
- 構造化データテストツールで検証
- モバイルフレンドリーテストで確認

## 注意事項

- **UIや機能は一切変更していません**。既存の表示内容、リンク、機能はそのままです。
- メタ情報のみを追加・最適化しています。
- 構造化データは検索エンジン向けの情報で、ユーザーには表示されません。
- サイトマップは動的に生成されるため、新しい学校や口コミが追加されると自動的に反映されます。
