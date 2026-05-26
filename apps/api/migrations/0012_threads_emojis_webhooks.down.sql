ALTER TABLE channels DROP COLUMN IF EXISTS icon_hash;
ALTER TABLE channels DROP COLUMN IF EXISTS owner_id;
DROP TABLE IF EXISTS user_guild_settings;
DROP TABLE IF EXISTS user_channel_settings;
DROP TYPE IF EXISTS notif_level;
DROP TABLE IF EXISTS read_states;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS guild_emojis;
DROP TABLE IF EXISTS thread_members;
DROP TABLE IF EXISTS thread_metadata;
-- ENUM ADD VALUE geri alınamaz; manuel düşürme gerekirse type drop edip yeniden oluştur
