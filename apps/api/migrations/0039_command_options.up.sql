-- Slash komut argümanları: [{name, description, required}]
ALTER TABLE guild_commands ADD COLUMN IF NOT EXISTS options JSONB;
