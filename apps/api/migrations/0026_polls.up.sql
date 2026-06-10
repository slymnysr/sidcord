-- Anketler (Polls) — mesaja bağlı
CREATE TABLE IF NOT EXISTS polls (
    id               BIGINT PRIMARY KEY,
    message_id       BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    channel_id       BIGINT NOT NULL,
    question         TEXT NOT NULL,
    allow_multiselect BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at       TIMESTAMPTZ,
    created_by       BIGINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_answers (
    id          BIGINT PRIMARY KEY,
    poll_id     BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    emoji       TEXT,
    position    INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id   BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    answer_id BIGINT NOT NULL REFERENCES poll_answers(id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_polls_message ON polls(message_id);
CREATE INDEX IF NOT EXISTS idx_poll_answers_poll ON poll_answers(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_answer ON poll_votes(answer_id);
