-- Epic2: 口コミいいね機能用テーブル
-- 作成日: Epic2実装時点

-- review_likesテーブルの作成
CREATE TABLE IF NOT EXISTS review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  user_ip TEXT, -- 簡易的なユーザー識別（本番では認証システムを使用）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_ip)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_ip ON review_likes(user_ip);

-- コメント
-- 本テーブルは簡易的ないいね機能の実装です。
-- 将来的には認証システム（ユーザーID）を使用することを推奨します。















