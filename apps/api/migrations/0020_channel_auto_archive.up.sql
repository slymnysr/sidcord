-- Kanal "Etkin Olmadığında Gizle" süresi (dakika). 0 = kapalı (gizleme yok).
ALTER TABLE channels ADD COLUMN IF NOT EXISTS auto_archive_minutes INT NOT NULL DEFAULT 0;
