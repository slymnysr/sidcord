-- Onboarding soruları: ilgi-bazlı seçimler → rol atama
-- Format: [{id, title, options: [{id, label, emoji, role_ids: [..]}]}]
ALTER TABLE guild_welcome ADD COLUMN IF NOT EXISTS onboarding_prompts JSONB NOT NULL DEFAULT '[]';
