CREATE TABLE IF NOT EXISTS saved_messages (
    user_id    BIGINT NOT NULL,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_messages_user ON saved_messages(user_id, saved_at DESC);
