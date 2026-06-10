-- Duyuru kanalı takibi (Discord "follow announcement channel" paritesi)
CREATE TABLE IF NOT EXISTS channel_follows (
    id                BIGINT PRIMARY KEY,
    source_channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    target_channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    created_by        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_channel_id, target_channel_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_follows_source ON channel_follows(source_channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_follows_target ON channel_follows(target_channel_id);

-- Yayınlanmış (crosspost edilmiş) mesaj işareti
ALTER TABLE messages ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
