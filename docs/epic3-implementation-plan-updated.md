# Epic3 実装計画: 特集ページ・CMS機能（更新版）

## 概要

通信制高校に関する特集ページ機能とCMS管理画面を実装します。以下の機能を含みます：

### 1. 特集ページ機能
- **リアル体験談 クチコミ・インタビュー**（記事形式）
- **通信制高校お役立ち情報**（記事形式）

### 2. 記事管理CMS
- 記事の作成・編集・削除
- 公開/非公開管理
- SEO設定（メタタイトル、メタ説明）

### 3. 学校管理CMS
- 学校詳細情報の編集（紹介文、特徴、FAQなど）
- 公開/非公開管理
- スラッグの編集
- **口コミデータの採用/不採用管理（is_publicフラグの管理）**

**注意**: 平均点の計算は既に`is_public = true`の口コミのみを対象としており、口コミの採用/不採用を変更すると自動的に平均点が再計算されます（既存のAPI実装により）。

---

## 実装フェーズ詳細

### Phase 1: データベーススキーマ設計・作成

#### 1.1 記事テーブル（articles）の作成
**ファイル**: `supabase-schema-epic3-articles.sql`

```sql
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'interview' (リアル体験談 クチコミ・インタビュー), 'useful_info' (通信制高校お役立ち情報)
  content TEXT, -- Markdown形式の本文
  excerpt TEXT, -- 記事の抜粋
  featured_image_url TEXT, -- アイキャッチ画像URL
  is_public BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  meta_title TEXT, -- SEO用タイトル
  meta_description TEXT -- SEO用説明文
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_is_public ON articles(is_public);
CREATE INDEX idx_articles_published_at ON articles(published_at) WHERE is_public = true;

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at 
  BEFORE UPDATE ON articles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_articles_updated_at();
```

**説明**:
- `category`: 記事タイプを識別（`interview`=リアル体験談 クチコミ・インタビュー、`useful_info`=通信制高校お役立ち情報）
- `content`: Markdown形式で保存
- `excerpt`: 一覧表示用の抜粋文
- `published_at`: 公開日時（公開時の日時を記録）

---

### Phase 2: 型定義とユーティリティ

#### 2.1 記事関連の型定義
**ファイル**: `lib/types/articles.ts`（新規作成）

```typescript
export type ArticleCategory = 'interview' | 'useful_info';

export interface Article {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface ArticleFormData {
  title: string;
  slug: string;
  category: ArticleCategory;
  content: string;
  excerpt: string;
  featured_image_url: string;
  is_public: boolean;
  published_at: string | null;
  meta_title: string;
  meta_description: string;
}
```

#### 2.2 学校関連の型定義
**ファイル**: `lib/types/schools.ts`（新規作成）

```typescript
export interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  intro: string | null;
  highlights: string[] | null; // JSONB配列
  faq: Array<{ question: string; answer: string }> | null; // JSONB配列
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolFormData {
  name: string;
  prefecture: string;
  slug: string;
  intro: string;
  highlights: string[];
  faq: Array<{ question: string; answer: string }>;
  is_public: boolean;
}
```

#### 2.3 口コミ関連の型定義（学校管理CMS用）
**ファイル**: `lib/types/reviews.ts`（新規作成）

```typescript
export interface Review {
  id: string;
  school_id: string | null;
  school_name: string;
  respondent_role: string;
  status: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  is_public: boolean;
  created_at: string;
}

export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
```

#### 2.4 Slug生成関数の拡張
**ファイル**: `lib/utils.ts`

既存の`generateSlug`関数を確認し、必要に応じて拡張（記事タイトル用にも使用可能にする）。

---

### Phase 3: API実装（記事管理）

#### 3.1 記事一覧取得API
**ファイル**: `app/api/articles/route.ts`（新規作成）

**エンドポイント**: `GET /api/articles`

**機能**:
- 公開済み記事の一覧取得
- クエリパラメータ: `category`（オプション: `interview`または`useful_info`）、`page`、`limit`
- カテゴリと公開日順でソート

**レスポンス例**:
```json
{
  "articles": [
    {
      "id": "uuid",
      "title": "通信制高校の選び方",
      "slug": "how-to-choose",
      "category": "useful_info",
      "excerpt": "記事の抜粋...",
      "featured_image_url": "https://...",
      "published_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20,
  "total_pages": 1
}
```

#### 3.2 記事詳細取得API
**ファイル**: `app/api/articles/[slug]/route.ts`（新規作成）

**エンドポイント**: `GET /api/articles/[slug]`

**機能**:
- 公開済み記事の詳細取得

**レスポンス例**:
```json
{
  "id": "uuid",
  "title": "通信制高校の選び方",
  "slug": "how-to-choose",
  "category": "useful_info",
  "content": "# Markdown content...",
  "excerpt": "記事の抜粋...",
  "featured_image_url": "https://...",
  "published_at": "2024-01-01T00:00:00Z",
  "meta_title": "SEOタイトル",
  "meta_description": "SEO説明文"
}
```

#### 3.3 CMS管理API（記事作成）
**ファイル**: `app/api/admin/articles/route.ts`（新規作成）

**エンドポイント**: `POST /api/admin/articles`

**機能**:
- 記事の作成
- バリデーション（タイトル、スラッグの重複チェックなど）

**リクエストボディ**:
```json
{
  "title": "記事タイトル",
  "slug": "article-slug",
  "category": "interview",
  "content": "Markdown content...",
  "excerpt": "抜粋文",
  "featured_image_url": "https://...",
  "is_public": true,
  "meta_title": "SEOタイトル",
  "meta_description": "SEO説明文"
}
```

#### 3.4 CMS管理API（記事更新・削除・取得）
**ファイル**: `app/api/admin/articles/[id]/route.ts`（新規作成）

**エンドポイント**:
- `GET /api/admin/articles/[id]` - 記事取得（非公開も含む）
- `PUT /api/admin/articles/[id]` - 記事更新
- `DELETE /api/admin/articles/[id]` - 記事削除

---

### Phase 4: API実装（学校管理）

#### 4.1 学校管理API（一覧取得）
**ファイル**: `app/api/admin/schools/route.ts`（新規作成）

**エンドポイント**: `GET /api/admin/schools`

**機能**:
- 学校一覧取得（非公開含む）
- クエリパラメータ: `page`、`limit`、`q`（検索）

#### 4.2 学校管理API（詳細取得・更新）
**ファイル**: `app/api/admin/schools/[id]/route.ts`（新規作成）

**エンドポイント**:
- `GET /api/admin/schools/[id]` - 学校詳細取得（非公開含む）
- `PUT /api/admin/schools/[id]` - 学校情報更新

**リクエストボディ（PUT）**:
```json
{
  "name": "学校名",
  "prefecture": "東京都",
  "slug": "school-slug",
  "intro": "紹介文",
  "highlights": ["特徴1", "特徴2"],
  "faq": [
    { "question": "質問1", "answer": "回答1" }
  ],
  "is_public": true
}
```

#### 4.3 学校に紐づく口コミ一覧取得API
**ファイル**: `app/api/admin/schools/[id]/reviews/route.ts`（新規作成）

**エンドポイント**: `GET /api/admin/schools/[id]/reviews`

**機能**:
- 学校に紐づく口コミ一覧取得（公開/非公開すべて）
- クエリパラメータ: `page`、`limit`、`is_public`（フィルタ）
- 作成日時の降順でソート

**レスポンス例**:
```json
{
  "reviews": [
    {
      "id": "uuid",
      "school_id": "uuid",
      "school_name": "A高校",
      "respondent_role": "本人",
      "status": "在籍中",
      "overall_satisfaction": 5,
      "good_comment": "良かった点...",
      "bad_comment": "改善点...",
      "is_public": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20,
  "total_pages": 1
}
```

#### 4.4 口コミの採用/不採用管理API
**ファイル**: `app/api/admin/reviews/[id]/route.ts`（新規作成）

**エンドポイント**: `PUT /api/admin/reviews/[id]`

**機能**:
- 口コミの`is_public`フラグを更新
- 平均点の再計算は既存のAPIで自動的に行われる（`is_public = true`のみを対象として計算）

**リクエストボディ**:
```json
{
  "is_public": false
}
```

**レスポンス例**:
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "is_public": false
  }
}
```

---

### Phase 5: CMS管理画面実装（記事管理）

#### 5.1 記事一覧ページ
**ファイル**: `app/admin/articles/page.tsx`（新規作成）

**機能**:
- 記事一覧表示（公開/非公開含む）
- カテゴリフィルタ（interview/useful_info）
- 検索機能
- 記事作成ボタン
- 記事編集・削除リンク
- ページネーション

**UI要素**:
- テーブル形式の一覧表示
- カテゴリバッジ（リアル体験談 クチコミ・インタビュー / 通信制高校お役立ち情報）
- 公開状態インジケーター
- 作成日時・更新日時表示

#### 5.2 記事作成ページ
**ファイル**: `app/admin/articles/new/page.tsx`（新規作成）

**機能**:
- 記事作成フォーム
- カテゴリ選択（interview/useful_info）
- Markdownエディタ（簡易実装、textarea使用）
- 公開フラグ設定
- SEO設定（メタタイトル、メタ説明）
- スラッグ自動生成（タイトルから）

**フォーム項目**:
- タイトル（必須）
- スラッグ（必須、タイトルから自動生成、編集可能）
- カテゴリ（必須）
- 抜粋文
- 本文（Markdown）
- アイキャッチ画像URL
- 公開フラグ
- メタタイトル
- メタ説明

#### 5.3 記事編集ページ
**ファイル**: `app/admin/articles/[id]/edit/page.tsx`（新規作成）

**機能**:
- 記事編集フォーム（作成ページと同様）
- 既存データの読み込み

#### 5.4 記事管理コンポーネント
**ファイル**: `components/ArticleEditor.tsx`（新規作成）

**機能**:
- 記事編集フォームコンポーネント
- カテゴリ選択
- Markdownコンテンツ編集
- メタ情報入力
- バリデーション

---

### Phase 6: CMS管理画面実装（学校管理）

#### 6.1 学校一覧ページ
**ファイル**: `app/admin/schools/page.tsx`（新規作成）

**機能**:
- 学校一覧表示（公開/非公開含む）
- 検索機能（学校名）
- 都道府県フィルタ
- 学校編集リンク
- ページネーション

**UI要素**:
- テーブル形式の一覧表示
- 学校名、都道府県、スラッグ表示
- 公開状態インジケーター
- 口コミ数・平均評価の表示（参考情報、`is_public = true`のみをカウント）

#### 6.2 学校編集ページ
**ファイル**: `app/admin/schools/[id]/edit/page.tsx`（新規作成）

**機能**:
- 学校情報編集フォーム
- 既存データの読み込み
- バリデーション（学校名の重複チェックなど）
- **口コミ管理タブ**（新規追加）

**フォーム項目（基本情報タブ）**:
- 学校名（必須）
- 都道府県（必須）
- スラッグ（必須、自動生成、編集可能）
- 紹介文（テキストエリア）
- 特徴・推しポイント（配列エディタ）
- FAQ（質問・回答の配列エディタ）
- 公開フラグ

**フォーム項目（口コミ管理タブ）**:
- 学校に紐づく口コミ一覧表示
- 各口コミの採用/不採用切り替え（トグルボタン）
- 口コミの詳細表示（モーダルまたは展開表示）
- フィルタリング（採用のみ/不採用のみ/すべて）
- ページネーション

#### 6.3 学校管理コンポーネント
**ファイル**: `components/SchoolEditor.tsx`（新規作成）

**機能**:
- 学校編集フォームコンポーネント
- 紹介文エディタ
- 特徴配列エディタ
- FAQ配列エディタ（質問・回答ペア）
- タブ切り替えUI（基本情報/口コミ管理）

**ファイル**: `components/JsonArrayEditor.tsx`（新規作成）

**機能**:
- JSONB配列の編集UI（汎用コンポーネント）
- 項目の追加・削除・並び替え
- highlights用（文字列配列）
- FAQ用（オブジェクト配列：質問・回答ペア）

**ファイル**: `components/ReviewManagementList.tsx`（新規作成）

**機能**:
- 口コミ一覧表示（学校管理用）
- 採用/不採用のトグルボタン
- 口コミ詳細の表示（モーダルまたは展開）
- フィルタリングUI（採用/不採用/すべて）
- ページネーション

---

### Phase 7: フロントエンド実装（特集ページ）

#### 7.1 特集ページ一覧
**ファイル**: `app/features/page.tsx`（新規作成）

**機能**:
- 記事一覧表示
- カテゴリタブ（リアル体験談 クチコミ・インタビュー / 通信制高校お役立ち情報）
- 記事カード表示
- ページネーション

**UI要素**:
- タブナビゲーション（カテゴリ切り替え）
- 記事カードグリッド表示
- アイキャッチ画像、タイトル、抜粋、公開日表示

#### 7.2 記事詳細ページ
**ファイル**: `app/features/[slug]/page.tsx`（新規作成）

**機能**:
- 記事詳細表示
- Markdownコンテンツのレンダリング
- SEOメタタグ設定

**UI要素**:
- ヘッダー（タイトル、公開日、アイキャッチ画像）
- Markdownコンテンツ本文
- 関連リンク（他の特集ページへのリンク）

#### 7.3 フロントエンドコンポーネント
**ファイル**: `components/ArticleCard.tsx`（新規作成）

**機能**:
- 記事カードコンポーネント
- アイキャッチ画像、タイトル、抜粋、公開日を表示
- カテゴリバッジ表示

**ファイル**: `components/MarkdownRenderer.tsx`（新規作成）

**機能**:
- Markdownコンテンツのレンダリング
- react-markdownライブラリを使用
- スタイリング適用

---

### Phase 8: 依存関係の追加と統合

#### 8.1 パッケージの追加
**ファイル**: `package.json`

以下のパッケージを追加：
```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  }
}
```

#### 8.2 統合テスト
- 各APIの動作確認
- CMS管理画面の動作確認
- フロントエンドページの表示確認
- 口コミの採用/不採用切り替えによる平均点の再計算確認

---

## 実装順序（推奨）

1. **Phase 1**: データベーススキーマ作成
2. **Phase 2**: 型定義とユーティリティ
3. **Phase 3**: 記事管理API実装
4. **Phase 4**: 学校管理API実装（口コミ管理含む）
5. **Phase 5**: CMS管理画面実装（記事管理）
6. **Phase 6**: CMS管理画面実装（学校管理・口コミ管理）
7. **Phase 7**: フロントエンド実装（特集ページ）
8. **Phase 8**: 依存関係の追加と統合テスト

---

## ファイル一覧

### SQLファイル（新規作成）
- `supabase-schema-epic3-articles.sql`

### 型定義（新規作成）
- `lib/types/articles.ts`
- `lib/types/schools.ts`
- `lib/types/reviews.ts`

### API Route - 記事管理（新規作成）
- `app/api/articles/route.ts`
- `app/api/articles/[slug]/route.ts`
- `app/api/admin/articles/route.ts`
- `app/api/admin/articles/[id]/route.ts`

### API Route - 学校管理（新規作成）
- `app/api/admin/schools/route.ts`
- `app/api/admin/schools/[id]/route.ts`
- `app/api/admin/schools/[id]/reviews/route.ts`
- `app/api/admin/reviews/[id]/route.ts`

### CMS管理画面 - 記事管理（新規作成）
- `app/admin/articles/page.tsx`
- `app/admin/articles/new/page.tsx`
- `app/admin/articles/[id]/edit/page.tsx`

### CMS管理画面 - 学校管理（新規作成）
- `app/admin/schools/page.tsx`
- `app/admin/schools/[id]/edit/page.tsx`

### フロントエンド（新規作成）
- `app/features/page.tsx`
- `app/features/[slug]/page.tsx`

### コンポーネント（新規作成）
- `components/ArticleCard.tsx`
- `components/ArticleEditor.tsx`
- `components/SchoolEditor.tsx`
- `components/JsonArrayEditor.tsx`
- `components/MarkdownRenderer.tsx`
- `components/ReviewManagementList.tsx`

### 既存ファイルの修正
- `lib/utils.ts` - slug生成関数の拡張（必要に応じて）
- `package.json` - 依存関係の追加

---

## 注意事項

### 平均点の自動計算について
- 既存の実装（`app/api/schools/[slug]/route.ts`など）では、`is_public = true`の口コミのみを対象として平均点を計算しています
- 口コミの`is_public`フラグを変更すると、次回のAPI呼び出し時に自動的に新しい平均点が計算されます
- データベースに集計結果を保存する必要はありません（リアルタイムで計算）

### セキュリティ
- 認証システムは実装しない（簡易CMS）
- 本番環境では認証システムの実装を強く推奨
- `/admin`配下のページは本番環境では認証を必須とする

### 機能の制限事項
- Markdownエディタは簡易実装（textarea）から開始
- 将来的にリッチテキストエディタ（例: Lexical、Tiptap）への移行を検討
- 画像アップロード機能は将来的な拡張として検討（現時点ではURL入力）

### SEO
- 各ページで適切なメタタグを設定
- 構造化データ（JSON-LD）の追加を検討

### パフォーマンス
- 記事一覧・学校一覧ではページネーションを実装
- インデックスを適切に設定（既にSQLで定義済み）
- 口コミ一覧のページネーションを実装（大量の口コミに対応）

---

## 参考情報

### 既存の実装パターン
- API Route: `app/api/schools/search/route.ts`を参考
- コンポーネント: `components/SchoolCard.tsx`を再利用可能
- ページ構造: `app/schools/[slug]/page.tsx`を参考
- 口コミ一覧: `app/api/reviews/route.ts`を参考

### データベーステーブル
- `schools`テーブル（既存）: Epic1で作成済み
- `survey_responses`テーブル（既存）: Epic1で作成済み、`is_public`カラムあり
- `articles`テーブル（新規）: Epic3で作成











