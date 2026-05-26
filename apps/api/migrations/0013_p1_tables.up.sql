-- ===== THREADS =====
CREATE TABLE thread_metadata (
    channel_id          BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
    archived            BOOLEAN NOT NULL DEFAULT FALSE,
    archive_timestamp   TIMESTAMPTZ,
    auto_archive_minutes INT NOT NULL DEFAULT 1440,
    locked              BOOLEAN NOT NULL DEFAULT FALSE,
    invitable           BOOLEAN NOT NULL DEFAULT TRUE,
    creator_id          BIGINT NOT NULL REFERENCES users(id),
    message_count       INT NOT NULL DEFAULT 0,
    member_count        INT NOT NULL DEFAULT 1,
    starter_message_id  BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE thread_members (
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX idx_thread_members_user ON thread_members(user_id);

-- ===== CUSTOM EMOJIS =====
CREATE TABLE guild_emojis (
    id          BIGINT PRIMARY KEY,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    animated    BOOLEAN NOT NULL DEFAULT FALSE,
    creator_id  BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guild_id, name)
);
CREATE INDEX idx_guild_emojis_guild ON guild_emojis(guild_id);

-- ===== WEBHOOKS =====
CREATE TABLE webhooks (
    id          BIGINT PRIMARY KEY,
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    creator_id  BIGINT NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    avatar_url  TEXT,
    token_hash  TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_webhooks_channel ON webhooks(channel_id);

-- ===== READ STATE =====
CREATE TABLE read_states (
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id          BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_message_id     BIGINT,
    mention_count       INT NOT NULL DEFAULT 0,
    last_read_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX idx_read_states_user ON read_states(user_id, last_read_at DESC);

-- ===== NOTIFICATION SETTINGS =====
CREATE TYPE notif_level AS ENUM ('all', 'mentions', 'nothing');

CREATE TABLE user_channel_settings (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    muted_until     TIMESTAMPTZ,
    notif_level     notif_level,
    PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE user_guild_settings (
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id          BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    muted_until       TIMESTAMPTZ,
    notif_level       notif_level NOT NULL DEFAULT 'all',
    suppress_everyone BOOLEAN NOT NULL DEFAULT FALSE,
    suppress_roles    BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, guild_id)
);

-- ===== GROUP DM ek alanlar =====
ALTER TABLE channels ADD COLUMN owner_id BIGINT REFERENCES users(id);
ALTER TABLE channels ADD COLUMN icon_hash TEXT;
