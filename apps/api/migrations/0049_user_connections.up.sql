-- Hesap bağlantıları (Discord "Connections" paritesi)
-- OAuth ile doğrulanan (verified) veya elle eklenen platform hesapları; profilde gösterilir.
CREATE TABLE IF NOT EXISTS user_connections (
    id          BIGINT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    name        TEXT NOT NULL,
    external_id TEXT,
    verified    BOOLEAN NOT NULL DEFAULT FALSE,
    visible     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, type, name)
);
CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id);
