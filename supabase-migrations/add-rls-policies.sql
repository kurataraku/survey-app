-- RLSポリシーの追加
-- 公開前のセキュリティ強化

-- ============================================
-- schoolsテーブルのRLS
-- ============================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "公開側はactiveな学校のみ参照可能" ON schools;
DROP POLICY IF EXISTS "管理者はschoolsを全操作可能" ON schools;

-- 公開側: activeな学校のみSELECT可能
CREATE POLICY "公開側はactiveな学校のみ参照可能"
  ON schools
  FOR SELECT
  USING (status = 'active' AND is_public = true);

-- 管理者: 全操作可能（service_roleキーはRLSをバイパスするため、ここではauthenticatedロールを想定）
-- 注意: 実際の認証実装に合わせて調整が必要
CREATE POLICY "管理者はschoolsを全操作可能"
  ON schools
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================
-- survey_responsesテーブルのRLS
-- ============================================
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "公開側は公開された口コミのみ参照可能" ON survey_responses;
DROP POLICY IF EXISTS "公開側はsurvey_responsesにINSERT可能" ON survey_responses;
DROP POLICY IF EXISTS "管理者はsurvey_responsesを全操作可能" ON survey_responses;

-- 公開側: is_public=trueの口コミのみSELECT可能
CREATE POLICY "公開側は公開された口コミのみ参照可能"
  ON survey_responses
  FOR SELECT
  USING (is_public = true);

-- 公開側: INSERT可能（アンケート送信）
CREATE POLICY "公開側はsurvey_responsesにINSERT可能"
  ON survey_responses
  FOR INSERT
  WITH CHECK (true);

-- 管理者: 全操作可能
CREATE POLICY "管理者はsurvey_responsesを全操作可能"
  ON survey_responses
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================
-- articlesテーブルのRLS（存在する場合）
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'articles') THEN
    ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

    -- 既存のポリシーを削除（存在する場合）
    DROP POLICY IF EXISTS "公開側は公開された記事のみ参照可能" ON articles;
    DROP POLICY IF EXISTS "管理者はarticlesを全操作可能" ON articles;

    -- 公開側: is_public=trueの記事のみSELECT可能
    -- 注意: articlesテーブルはis_publicカラムを使用（is_publishedではない）
    CREATE POLICY "公開側は公開された記事のみ参照可能"
      ON articles
      FOR SELECT
      USING (is_public = true);

    -- 管理者: 全操作可能
    CREATE POLICY "管理者はarticlesを全操作可能"
      ON articles
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================
-- review_likesテーブルのRLS（存在する場合）
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_likes') THEN
    ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

    -- 既存のポリシーを削除（存在する場合）
    DROP POLICY IF EXISTS "公開側はreview_likesを参照可能" ON review_likes;
    DROP POLICY IF EXISTS "公開側はreview_likesにINSERT可能" ON review_likes;
    DROP POLICY IF EXISTS "管理者はreview_likesを全操作可能" ON review_likes;

    -- 公開側: SELECT可能（いいね数の表示）
    CREATE POLICY "公開側はreview_likesを参照可能"
      ON review_likes
      FOR SELECT
      USING (true);

    -- 公開側: INSERT可能（いいねの追加）
    CREATE POLICY "公開側はreview_likesにINSERT可能"
      ON review_likes
      FOR INSERT
      WITH CHECK (true);

    -- 管理者: 全操作可能
    CREATE POLICY "管理者はreview_likesを全操作可能"
      ON review_likes
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================
-- school_aliasesテーブルのRLS（存在する場合）
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_aliases') THEN
    ALTER TABLE school_aliases ENABLE ROW LEVEL SECURITY;

    -- 既存のポリシーを削除（存在する場合）
    DROP POLICY IF EXISTS "公開側はschool_aliasesを参照可能" ON school_aliases;
    DROP POLICY IF EXISTS "管理者はschool_aliasesを全操作可能" ON school_aliases;

    -- 公開側: SELECT可能（検索用）
    CREATE POLICY "公開側はschool_aliasesを参照可能"
      ON school_aliases
      FOR SELECT
      USING (true);

    -- 管理者: 全操作可能
    CREATE POLICY "管理者はschool_aliasesを全操作可能"
      ON school_aliases
      FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
