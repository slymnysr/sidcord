CREATE TABLE message_reactions (
    message_id   BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji        TEXT NOT NULL,  -- unicode emoji veya :custom:
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX idx_reactions_message ON message_reactions(message_id);
