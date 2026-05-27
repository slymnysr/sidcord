DROP TABLE IF EXISTS message_embeds;
ALTER TABLE messages DROP COLUMN IF EXISTS forwarded_from_channel_id;
ALTER TABLE messages DROP COLUMN IF EXISTS forwarded_from_message_id;
DROP TABLE IF EXISTS user_guild_folder_members;
DROP TABLE IF EXISTS user_guild_folders;
DROP TABLE IF EXISTS guild_commands;
