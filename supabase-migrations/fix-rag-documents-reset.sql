-- インデックス作成エラーで途中まで適用された rag_documents をリセットする
-- 実行後、create-rag-documents.sql を再実行してください

DROP FUNCTION IF EXISTS match_rag_documents(VECTOR, INTEGER, TEXT, UUID, TEXT, TEXT[]);
DROP TABLE IF EXISTS rag_documents CASCADE;
