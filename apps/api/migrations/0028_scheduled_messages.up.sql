CREATE TABLE IF NOT EXISTS scheduled_messages (
    id            BIGINT PRIMARY KEY,
    channel_id    BIGINT NOT NULL,
    author_id     BIGINT NOT NULL,
    content       TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sched_due ON scheduled_messages(scheduled_for) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_sched_author ON scheduled_messages(author_id, channel_id);
