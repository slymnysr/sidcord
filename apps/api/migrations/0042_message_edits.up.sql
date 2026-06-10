-- Mesaj düzenleme geçmişi: her düzenlemede eski içerik saklanır
CREATE TABLE IF NOT EXISTS message_edits (
    id          BIGINT PRIMARY KEY,
    message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    old_content TEXT NOT NULL,
    edited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id, edited_at DESC);
