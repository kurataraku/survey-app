# Epic2 実装計画: Media MVP

Epic2では、通信制高校の口コミメディアサイトのフロントエンドとAPIを構築します。

## 実装目標

### 主要機能

1. **学校検索ページ** (`/schools`)
   - 学校名での検索
   - 都道府県でのフィルタリング
   - 学校一覧の表示（カード形式）

2. **学校個別ページ** (`/schools/[slug]`)
   - 学校の基本情報表示
   - 集計データの表示（平均評価、口コミ数など）
   - 口コミ一覧へのリンク
   - 最新の口コミの抜粋表示

3. **口コミ一覧ページ** (`/schools/[slug]/reviews`)
   - 学校に紐づく口コミの一覧表示
   - フィルタリング（評価順、新着順など）
   - ページネーション

4. **口コミ詳細ページ** (`/reviews/[id]`)
   - 口コミの詳細情報表示
   - いいね機能
   - 評価項目の詳細表示

5. **いいね機能**
   - 口コミにいいねを追加/削除
   - いいね数の表示

## データベース構造

### 使用するテーブル

1. **schools**
   - `id`, `name`, `prefecture`, `slug`, `intro`, `highlights`, `faq`, `is_public`

2. **survey_responses**
   - `id`, `school_id`, `school_name`, `overall_satisfaction`, `good_comment`, `bad_comment`, `enrollment_year`, `attendance_frequency`, `staff_rating`, `atmosphere_fit_rating`, `credit_rating`, `tuition_rating`, `created_at`, `is_public`

3. **aggregates**（参考のみ、Epic3で集計更新機能を実装）
   - `school_id`, `review_count`, `overall_avg`, `staff_rating_avg`, etc.

### いいね機能用テーブル（新規作成が必要）

Epic2で`review_likes`テーブルを作成する必要があります：

```sql
CREATE TABLE IF NOT EXISTS review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  user_ip TEXT, -- 簡易的なユーザー識別（本番では認証システムを使用）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_ip)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
```

## API設計

### 1. 学校検索API

**Endpoint**: `GET /api/schools/search`

**Query Parameters**:
- `q` (optional): 検索キーワード（学校名）
- `prefecture` (optional): 都道府県
- `page` (optional): ページ番号（デフォルト: 1）
- `limit` (optional): 1ページあたりの件数（デフォルト: 20）

**Response**:
```json
{
  "schools": [
    {
      "id": "uuid",
      "name": "学校名",
      "prefecture": "都道府県",
      "slug": "school-slug",
      "review_count": 10,
      "overall_avg": 4.2
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### 2. 学校情報取得API

**Endpoint**: `GET /api/schools/[slug]`

**Response**:
```json
{
  "id": "uuid",
  "name": "学校名",
  "prefecture": "都道府県",
  "slug": "school-slug",
  "intro": "学校紹介文",
  "highlights": {...},
  "faq": {...},
  "review_count": 10,
  "overall_avg": 4.2,
  "staff_rating_avg": 4.0,
  "atmosphere_fit_rating_avg": 3.8,
  "credit_rating_avg": 4.5,
  "tuition_rating_avg": 3.9,
  "latest_reviews": [
    {
      "id": "uuid",
      "overall_satisfaction": 5,
      "good_comment": "良かった点",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. 口コミ一覧取得API

**Endpoint**: `GET /api/reviews`

**Query Parameters**:
- `school_id` (optional): 学校IDでフィルタ
- `school_slug` (optional): 学校スラッグでフィルタ
- `sort` (optional): ソート順（`newest`, `oldest`, `rating_desc`, `rating_asc`, デフォルト: `newest`）
- `page` (optional): ページ番号（デフォルト: 1）
- `limit` (optional): 1ページあたりの件数（デフォルト: 20）

**Response**:
```json
{
  "reviews": [
    {
      "id": "uuid",
      "school_id": "uuid",
      "school_name": "学校名",
      "school_slug": "school-slug",
      "overall_satisfaction": 5,
      "good_comment": "良かった点",
      "bad_comment": "改善点",
      "enrollment_year": 2024,
      "attendance_frequency": "月1回",
      "staff_rating": 5,
      "atmosphere_fit_rating": 4,
      "credit_rating": 5,
      "tuition_rating": 4,
      "like_count": 10,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### 4. 口コミ詳細取得API

**Endpoint**: `GET /api/reviews/[id]`

**Response**:
```json
{
  "id": "uuid",
  "school_id": "uuid",
  "school_name": "学校名",
  "school_slug": "school-slug",
  "respondent_role": "本人",
  "status": "在籍中",
  "overall_satisfaction": 5,
  "good_comment": "良かった点",
  "bad_comment": "改善点",
  "enrollment_year": 2024,
  "attendance_frequency": "月1回",
  "reason_for_choosing": ["心の不調のため", "全日制の学習スタイルが合わないため"],
  "staff_rating": 5,
  "atmosphere_fit_rating": 4,
  "credit_rating": 5,
  "tuition_rating": 4,
  "like_count": 10,
  "is_liked": false, -- 現在のユーザー（IP）がいいねしているか
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 5. いいね機能API

**Endpoint**: `POST /api/reviews/[id]/like`

**Request Body**:
```json
{
  "action": "like" | "unlike"
}
```

**Response**:
```json
{
  "success": true,
  "like_count": 11,
  "is_liked": true
}
```

## ページ構成

### 1. 学校検索ページ (`/schools`)

- 検索フォーム（学校名、都道府県）
- 学校カード一覧（グリッド表示）
- ページネーション

### 2. 学校個別ページ (`/schools/[slug]`)

- 学校の基本情報
- 集計データの表示（星評価、数値評価など）
- 口コミ一覧へのリンク
- 最新の口コミの抜粋表示（3件程度）

### 3. 口コミ一覧ページ (`/schools/[slug]/reviews`)

- 学校名と基本情報のヘッダー
- フィルタリングUI（ソート順選択）
- 口コミカード一覧
- ページネーション

### 4. 口コミ詳細ページ (`/reviews/[id]`)

- 口コミの詳細情報
- 評価項目の詳細表示
- いいねボタン
- 学校へのリンク

## コンポーネント設計

### 共通コンポーネント

1. **SchoolCard** - 学校カード
   - 学校名、都道府県、評価、口コミ数

2. **ReviewCard** - 口コミカード
   - 評価、コメント抜粋、投稿日時、いいね数

3. **StarRating** - 星評価表示（既存のコンポーネントを拡張）
   - 5段階評価の表示

4. **RatingDisplay** - 評価項目の表示
   - 各評価項目（スタッフ、雰囲気、単位、学費など）の表示

5. **LikeButton** - いいねボタン
   - いいね数、いいね状態の表示と切り替え

## 実装順序

1. **データベース準備**
   - `review_likes`テーブルの作成

2. **API実装**
   - 学校検索API
   - 学校情報取得API
   - 口コミ一覧取得API
   - 口コミ詳細取得API
   - いいね機能API

3. **共通コンポーネント実装**
   - SchoolCard, ReviewCard, RatingDisplay, LikeButton

4. **ページ実装**
   - 学校検索ページ
   - 学校個別ページ
   - 口コミ一覧ページ
   - 口コミ詳細ページ

5. **スタイリングとUX改善**
   - Tailwind CSSでのスタイリング
   - レスポンシブデザイン
   - ローディング状態の表示
   - エラーハンドリング

6. **動作確認とテスト**
   - 各ページの動作確認
   - APIの動作確認
   - エラーケースのテスト

## 注意事項

- 集計データ（aggregates）はEpic3で実装するため、Epic2ではリアルタイムで集計するか、簡易的な集計を行う
- いいね機能は簡易的な実装（IPベース）とし、Epic3以降で認証システムに移行することを想定
- 公開フラグ（`is_public`）を考慮して、非公開データは表示しない
- SEOを考慮したメタタグの設定
- パフォーマンスを考慮したページネーションとインデックスの活用





