-- Sunucu sticker'ları (PNG/APNG, 320x320, max 500KB)
CREATE TABLE guild_stickers (
    id          BIGINT PRIMARY KEY,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 30),
    description TEXT,
    tags        TEXT, -- virgülle ayrılmış arama etiketleri
    url         TEXT NOT NULL,
    format      TEXT NOT NULL DEFAULT 'png' CHECK (format IN ('png', 'apng', 'lottie')),
    creator_id  BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stickers_guild ON guild_stickers(guild_id);

-- Push notification abonelikleri (Web Push API)
CREATE TABLE push_subscriptions (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, endpoint)
);
