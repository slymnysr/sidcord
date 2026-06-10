-- Per-sunucu profil: sunucu-bazlı avatar ve bio (takma ad zaten var)
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS guild_avatar_url TEXT;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS guild_bio TEXT;
