-- Postgres ENUM'a yeni değerler aynı transaction'da kullanılamaz.
-- Bu migration sadece ENUM'a yeni thread tipleri ekler.
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'public_thread';
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'private_thread';
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'news_thread';
