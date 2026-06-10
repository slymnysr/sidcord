-- Etkinlik hatırlatması: başlamadan önce aboneler bilgilendirilir (bir kez)
ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
