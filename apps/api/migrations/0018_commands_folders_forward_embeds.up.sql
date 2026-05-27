-- Slash commands: sunucu/uygulama komutları
CREATE TABLE guild_commands (
    id           BIGINT PRIMARY KEY,
    guild_id     BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 32),
    description  TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 100),
    response     TEXT NOT NULL, -- basit /komut → metin yanıt
    creator_id   BIGINT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guild_id, name)
);
CREATE INDEX idx_guild_commands_guild ON guild_commands(guild_id);

-- Sunucu klasörleri: kullanıcının kendi sol-rail gruplandırması
CREATE TABLE user_guild_folders (
    id           BIGINT PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    color        INT NOT NULL DEFAULT 8421504, -- gri varsayılan
    position     INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_folders ON user_guild_folders(user_id, position);

CREATE TABLE user_guild_folder_members (
    folder_id    BIGINT NOT NULL REFERENCES user_guild_folders(id) ON DELETE CASCADE,
    guild_id     BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    position     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (folder_id, guild_id)
);

-- Mesaj forward: orijinal mesajın referansı (Discord davranışı)
ALTER TABLE messages ADD COLUMN forwarded_from_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN forwarded_from_channel_id BIGINT REFERENCES channels(id) ON DELETE SET NULL;

-- Link embed önizleme: mesajdaki URL'ler için OG/meta cache
CREATE TABLE message_embeds (
    id           BIGINT PRIMARY KEY,
    message_id   BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    title        TEXT,
    description  TEXT,
    image_url    TEXT,
    site_name    TEXT,
    embed_type   TEXT NOT NULL DEFAULT 'link', -- link, image, video, article
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_embeds_message ON message_embeds(message_id);
