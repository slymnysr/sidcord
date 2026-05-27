-- Unread badge için: her kanalın son mesaj ID'sini cache'le
ALTER TABLE channels ADD COLUMN last_message_id BIGINT;

-- Mevcut kanallar için son mesajı doldur
UPDATE channels c
SET last_message_id = (
    SELECT m.id FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1
);

CREATE INDEX idx_channels_last_msg ON channels(last_message_id) WHERE last_message_id IS NOT NULL;
