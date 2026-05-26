-- Sunucu banları
CREATE TABLE guild_bans (
    guild_id     BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by    BIGINT NOT NULL REFERENCES users(id),
    reason       TEXT,
    banned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX idx_bans_guild ON guild_bans(guild_id);

-- Timeout (geçici susturma)
ALTER TABLE guild_members
    ADD COLUMN timeout_until TIMESTAMPTZ;
