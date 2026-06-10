-- Sistem mesajları (örn. "X sunucuya katıldı") — farklı render edilir
ALTER TABLE messages ADD COLUMN IF NOT EXISTS system BOOLEAN NOT NULL DEFAULT FALSE;
