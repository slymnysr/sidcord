-- Stage instances: aktif stage etkinlikleri (topic + privacy)
CREATE TABLE stage_instances (
    channel_id    BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
    guild_id      BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    topic         TEXT NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 120),
    privacy_level TEXT NOT NULL DEFAULT 'guild_only' CHECK (privacy_level IN ('guild_only', 'public')),
    started_by    BIGINT NOT NULL REFERENCES users(id),
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled events: sunucu etkinlikleri (sesli kanal / stage / harici)
CREATE TYPE event_status AS ENUM ('scheduled', 'active', 'completed', 'canceled');
CREATE TYPE event_entity_type AS ENUM ('stage_instance', 'voice', 'external');

CREATE TABLE guild_events (
    id                  BIGINT PRIMARY KEY,
    guild_id            BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id          BIGINT REFERENCES channels(id) ON DELETE SET NULL,
    creator_id          BIGINT NOT NULL REFERENCES users(id),
    name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    description         TEXT,
    scheduled_start_at  TIMESTAMPTZ NOT NULL,
    scheduled_end_at    TIMESTAMPTZ,
    entity_type         event_entity_type NOT NULL,
    entity_location     TEXT, -- external event için harici yer (URL veya adres)
    status              event_status NOT NULL DEFAULT 'scheduled',
    image_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guild_events_guild ON guild_events(guild_id, scheduled_start_at);
CREATE INDEX idx_guild_events_status ON guild_events(status);

CREATE TABLE guild_event_subscribers (
    event_id   BIGINT NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- Soundboard: sunucuya yüklenmiş ses efektleri (Discord paritesi)
CREATE TABLE guild_sounds (
    id             BIGINT PRIMARY KEY,
    guild_id       BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 32),
    emoji          TEXT, -- isteğe bağlı emoji (örn. 🎺)
    file_url       TEXT NOT NULL,
    volume         REAL NOT NULL DEFAULT 1.0 CHECK (volume BETWEEN 0.0 AND 1.0),
    uploader_id    BIGINT NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sounds_guild ON guild_sounds(guild_id);

-- Media kanal tipi (Forum benzeri, görsel ağırlıklı)
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'media';
