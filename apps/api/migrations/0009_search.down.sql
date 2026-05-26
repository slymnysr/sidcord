DROP INDEX IF EXISTS idx_messages_channel_search;
DROP INDEX IF EXISTS idx_messages_search;
ALTER TABLE messages DROP COLUMN IF EXISTS search_vector;
