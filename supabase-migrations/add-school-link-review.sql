-- 学校が設定した公式サイトのリンクを、運営の承認一覧（確認待ち）に出すための列
-- 学校が保存するたびに NULL に戻り（＝未確認）、運営が「確認済みにする」を押すと日時が入る。
-- 公開は従来どおり保存した時点で即時（写真・メッセージと同じ「公開後に運営が確認」の扱い）。
-- 前提: add-school-official-link.sql を適用済みであること。

ALTER TABLE public.school_partnerships
  ADD COLUMN IF NOT EXISTS school_link_reviewed_at timestamptz;

-- 確認待ちの一覧を引くための部分インデックス
CREATE INDEX IF NOT EXISTS school_partnerships_link_unreviewed ON public.school_partnerships(school_link_updated_at)
  WHERE school_link_url IS NOT NULL AND school_link_reviewed_at IS NULL;
