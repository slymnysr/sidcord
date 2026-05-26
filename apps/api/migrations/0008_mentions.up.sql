CREATE TABLE message_mentions (
    message_id   BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_mentions_user ON message_mentions(user_id);

CREATE TABLE notifications (
    id           BIGINT PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,  -- 'mention', 'dm', 'friend_request', etc.
    channel_id   BIGINT REFERENCES channels(id) ON DELETE CASCADE,
    guild_id     BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
    message_id   BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    actor_id     BIGINT REFERENCES users(id),
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at NULLS FIRST, created_at DESC);
