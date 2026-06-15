-- 公式サイトURLの「確認状態」を管理するカラムを追加
-- AIエージェント（Perplexity）が自動特定したURLは official_url_verified = false で保存し、
-- 管理画面で人間が確認・保存すると official_url_verified = true（確定）になる。

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS official_url_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS official_url_source TEXT;

COMMENT ON COLUMN schools.official_url_verified IS '公式URLを人間が確認済みか（true=確認済み, false=AI推定など未確認）';
COMMENT ON COLUMN schools.official_url_source IS '公式URLの取得元: manual=人間入力 / ai=AIエージェント（Perplexity）自動特定';
