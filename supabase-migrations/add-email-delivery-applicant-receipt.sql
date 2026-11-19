-- 応募者向け「受付確認メール」を配信追跡の対象に加える
-- 前提: add-email-delivery-tracking.sql を適用済みであること。
-- kind の CHECK 制約に 'applicant_receipt' を追加する（ref_id には資料請求のIDを入れる）。

ALTER TABLE public.email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_kind_check;
ALTER TABLE public.email_deliveries ADD CONSTRAINT email_deliveries_kind_check
  CHECK (kind IN ('school_notification', 'school_invitation', 'applicant_receipt'));
