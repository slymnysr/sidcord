-- Sunucu susturma/sağırlaştırma kalıcılığı (voice server yeniden başlasa da korunur)
CREATE TABLE IF NOT EXISTS guild_voice_states (
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_mute BOOLEAN NOT NULL DEFAULT FALSE,
    server_deaf BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);
