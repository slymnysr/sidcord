-- DM gizliliği: kimler DM atabilir ('everyone' | 'friends')
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_dms_from TEXT NOT NULL DEFAULT 'everyone';
