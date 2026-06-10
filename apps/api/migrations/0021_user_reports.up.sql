-- Kullanıcı profil bildirileri (moderasyon için)
CREATE TABLE IF NOT EXISTS user_reports (
    id          BIGINT PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_reports_target ON user_reports(target_id);
