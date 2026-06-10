-- Webhook mesajlarında isim/avatar override kalıcılığı (sayfa yenilense de korunur)
CREATE TABLE IF NOT EXISTS message_webhook (
    message_id  BIGINT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    username    TEXT,
    avatar_url  TEXT,
    webhook_id  BIGINT
);
