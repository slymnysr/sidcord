-- Reaction roles: belirli mesaja belirli emoji ile tepki verince rol atanır
CREATE TABLE reaction_role_bindings (
    id           BIGINT PRIMARY KEY,
    guild_id     BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id   BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    emoji        TEXT NOT NULL,
    role_id      BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_by   BIGINT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (message_id, emoji, role_id)
);
CREATE INDEX idx_rr_message ON reaction_role_bindings(message_id);
CREATE INDEX idx_rr_guild ON reaction_role_bindings(guild_id);

-- Welcome / Onboarding ayarları (her sunucu için 1 satır)
CREATE TABLE guild_welcome (
    guild_id          BIGINT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    description       TEXT,
    welcome_channels  JSONB NOT NULL DEFAULT '[]', -- [{channel_id, description, emoji}]
    rules_text        TEXT,
    require_accept    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kullanıcının her sunucu için onboarding'i kabul edip etmediği
CREATE TABLE guild_member_onboarding (
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);
