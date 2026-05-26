CREATE TYPE automod_trigger_type AS ENUM (
    'keyword',          -- yasaklı kelime listesi
    'regex',            -- regex pattern
    'mention_spam',     -- N+ mention/saniye
    'message_spam',     -- N+ mesaj/saniye
    'link_blacklist',   -- domain blacklist
    'caps',             -- TÜMÜ BÜYÜK HARF
    'invite_blacklist'  -- başka sunucu davet linkleri
);

CREATE TYPE automod_action_type AS ENUM (
    'block',          -- mesajı engelle
    'timeout',        -- yazarı timeout
    'alert',          -- mod kanalına bildirim
    'delete'          -- mesajı sil
);

CREATE TABLE automod_rules (
    id          BIGINT PRIMARY KEY,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type automod_trigger_type NOT NULL,
    trigger_data JSONB NOT NULL DEFAULT '{}',
    actions     JSONB NOT NULL DEFAULT '[]',
    exempt_role_ids BIGINT[] NOT NULL DEFAULT '{}',
    exempt_channel_ids BIGINT[] NOT NULL DEFAULT '{}',
    creator_id  BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_automod_guild ON automod_rules(guild_id) WHERE enabled = TRUE;

-- Hangi mesajların hangi kurala takıldığı
CREATE TABLE automod_actions (
    id          BIGINT PRIMARY KEY,
    rule_id     BIGINT NOT NULL REFERENCES automod_rules(id) ON DELETE CASCADE,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id  BIGINT REFERENCES channels(id) ON DELETE CASCADE,
    message_content TEXT,
    action_type automod_action_type NOT NULL,
    matched_text TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_automod_actions_guild ON automod_actions(guild_id, created_at DESC);
CREATE INDEX idx_automod_actions_user ON automod_actions(user_id, created_at DESC);
