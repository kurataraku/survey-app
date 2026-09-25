-- 回答フォームに任意項目「主に通っていたキャンパスの市区町村」を追加（地域SEO再設計 第3波）
-- normalizeAnswers は answer_schema にないキーを破棄するため、キー定義を追加する。
-- 2026-09-25 に本番へ適用済み（冪等）。

INSERT INTO answer_schema (key, type, required, enum_values, aliases, description)
VALUES ('campus_city', 'string', false, NULL, NULL, '主に通っていたキャンパスの市区町村（任意）')
ON CONFLICT (key) DO UPDATE
SET type = EXCLUDED.type,
    required = EXCLUDED.required,
    description = EXCLUDED.description;
