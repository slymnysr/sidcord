-- Anahtar kelime bildirimleri (Discord "Highlight words"): kullanıcı belirlediği kelimeler geçince bildirilir
CREATE TABLE IF NOT EXISTS user_keywords (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_user_keywords_user ON user_keywords(user_id);
