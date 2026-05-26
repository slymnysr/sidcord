CREATE TABLE channel_pins (
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by   BIGINT NOT NULL REFERENCES users(id),
    pinned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, message_id)
);
CREATE INDEX idx_pins_channel ON channel_pins(channel_id, pinned_at DESC);
