-- Zengin embed (rich embed) için JSON yük: renk/alan/footer/author/thumbnail
ALTER TABLE message_embeds ADD COLUMN IF NOT EXISTS payload JSONB;
