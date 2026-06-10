-- Ses moderasyon aksiyonları için audit_action enum'una değer ekle
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'voice_mute';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'voice_deafen';
