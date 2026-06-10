-- E-posta token'ları: şifre sıfırlama + e-posta doğrulama/değiştirme
CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL,          -- password_reset | verify_email
    new_email  TEXT,                   -- e-posta değişiminde hedef adres (NULL = mevcut adresi doğrula)
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
