-- Bot platformu (Discord "Applications/Bots" paritesi)
-- Her uygulamanın bir bot kullanıcısı (users.bot=true) ve gizli token'ı (hash) vardır.
CREATE TABLE IF NOT EXISTS applications (
    id          BIGINT PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    bot_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    public      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_applications_owner ON applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_applications_token_hash ON applications(token_hash);
