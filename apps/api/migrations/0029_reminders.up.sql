CREATE TABLE IF NOT EXISTS reminders (
    id         BIGINT PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    message_id BIGINT,
    remind_at  TIMESTAMPTZ NOT NULL,
    fired      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at) WHERE fired = FALSE;
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, fired);
