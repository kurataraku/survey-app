-- batch-setup の intro_missing フィルタは intro IS NULL の校のみを列挙する。
-- 空文字・空白のみの intro を NULL に揃えると、再実行時の対象が漏れない（1回手動実行でよい）。
UPDATE schools
SET intro = NULL
WHERE intro IS NOT NULL AND length(trim(intro)) = 0;
