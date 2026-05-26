-- P0 ek şeması: reply + audit log + login_attempts + slowmode tracker + custom status

-- 1. Reply (mesaj cevap zinciri)
ALTER TABLE messages ADD COLUMN replied_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_replied_to ON messages(replied_to_id) WHERE replied_to_id IS NOT NULL;

-- 2. Mention metadata (everyone/here flag mesaj başına)
ALTER TABLE messages ADD COLUMN mention_everyone BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Custom status (kullanıcı seviyesi)
ALTER TABLE users ADD COLUMN custom_status_text TEXT;
ALTER TABLE users ADD COLUMN custom_status_emoji TEXT;
ALTER TABLE users ADD COLUMN custom_status_expires_at TIMESTAMPTZ;

-- 4. Audit log
CREATE TYPE audit_action AS ENUM (
    'guild_update', 'guild_delete',
    'channel_create', 'channel_update', 'channel_delete',
    'role_create', 'role_update', 'role_delete',
    'role_assign', 'role_unassign',
    'member_kick', 'member_ban', 'member_unban', 'member_timeout',
    'message_delete_mod', 'invite_create', 'invite_delete',
    'webhook_create', 'webhook_delete'
);

CREATE TABLE audit_logs (
    id          BIGINT PRIMARY KEY,
    guild_id    BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    actor_id    BIGINT NOT NULL REFERENCES users(id),
    target_id   BIGINT,
    action      audit_action NOT NULL,
    reason      TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_guild ON audit_logs(guild_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_action ON audit_logs(guild_id, action);

-- 5. Login attempts (brute-force koruması)
CREATE TABLE login_attempts (
    id          BIGINT PRIMARY KEY,
    email       TEXT NOT NULL,
    ip          INET,
    success     BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip, created_at DESC);

-- 6. Slowmode tracker (channel + user → son mesaj zamanı)
CREATE TABLE channel_user_throttle (
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (channel_id, user_id)
);

-- 7. Avatar URL kolonu zaten var (users tablosunda); banner ekleyelim
ALTER TABLE users ADD COLUMN banner_url TEXT;

-- 8. Channels'ta voice için bitrate + user limit
ALTER TABLE channels ADD COLUMN bitrate INT NOT NULL DEFAULT 64000;
ALTER TABLE channels ADD COLUMN user_limit INT NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN icon_url TEXT;

-- 9. Guilds'ta description ve banner zaten var, vanity URL ekleyelim
ALTER TABLE guilds ADD COLUMN vanity_url_code TEXT UNIQUE;
ALTER TABLE guilds ADD COLUMN banner_url TEXT;
ALTER TABLE guilds ADD COLUMN icon_url_v2 TEXT;  -- emoji yerine gerçek dosya URL
