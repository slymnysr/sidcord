-- Hesap silme: silinme zamanı işaretçisi (silinen hesap anonimleştirilir, login engellenir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
