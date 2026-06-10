-- AFK kanalına taşıma süresi (saniye) — afk_channel_id ile birlikte çalışır
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS afk_timeout_sec INTEGER NOT NULL DEFAULT 300;
