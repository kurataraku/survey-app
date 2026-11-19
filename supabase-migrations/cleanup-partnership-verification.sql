-- 学校提携の検証用ダミーデータを削除する。
--
-- 提携テーブルは ON DELETE RESTRICT で schools / school_partnerships を参照しているため、
-- 下の順番どおりに削除する（通知 → イベント → 請求 → 掲載内容 → 担当者 → 提携設定 → 学校）。
--
-- 写真を登録して検証した場合は、ストレージの school-partner-photos バケットにある
-- <school_id>/ 配下のファイルもダッシュボードから削除する（下のSELECTで対象パスを確認できる）。

-- 削除前の確認（残っている写真のパス）
SELECT id, kind, status, photo_path
FROM public.school_partner_content
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

BEGIN;

DELETE FROM public.school_partner_notifications
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

DELETE FROM public.school_material_request_events
WHERE request_id IN (
  SELECT id FROM public.school_material_requests
  WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b')
);

DELETE FROM public.school_material_requests
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

DELETE FROM public.school_partner_content
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

DELETE FROM public.school_partner_members
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

DELETE FROM public.school_partnerships
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

DELETE FROM public.schools
WHERE id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');

COMMIT;

-- 確認（0件になること）
SELECT count(*) AS remaining_schools FROM public.schools
WHERE id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');
SELECT count(*) AS remaining_requests FROM public.school_material_requests
WHERE school_id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');
