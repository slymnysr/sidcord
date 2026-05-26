CREATE TYPE channel_overwrite_target AS ENUM ('role', 'user');

CREATE TABLE channel_overwrites (
    channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    target_type  channel_overwrite_target NOT NULL,
    target_id    BIGINT NOT NULL,  -- role_id veya user_id
    allow        BIGINT NOT NULL DEFAULT 0,
    deny         BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, target_type, target_id)
);
CREATE INDEX idx_channel_overwrites_channel ON channel_overwrites(channel_id);
