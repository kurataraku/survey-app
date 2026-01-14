-- school_ai_summariesテーブルのRLSポリシー
-- 公開側は published のみ参照可能、管理系操作は Service Role 経由

ALTER TABLE school_ai_summaries ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "公開側は公開済み要約のみ参照可能" ON school_ai_summaries;
DROP POLICY IF EXISTS "管理者はschool_ai_summariesを全操作可能" ON school_ai_summaries;

-- 公開側: published のみ SELECT 可能
CREATE POLICY "公開側は公開済み要約のみ参照可能"
  ON school_ai_summaries
  FOR SELECT
  USING (status = 'published');

-- 管理者: 全操作可能（service_roleキーはRLSをバイパスするため、ここではauthenticatedロールを想定）
-- 注意: 実際の管理画面操作は Service Role 経由で行うため、このポリシーは補助的な役割
CREATE POLICY "管理者はschool_ai_summariesを全操作可能"
  ON school_ai_summaries
  FOR ALL
  USING (auth.role() = 'authenticated');
