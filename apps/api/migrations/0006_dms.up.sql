-- DM kanalları için katılımcı tablosu
-- channels tablosunda zaten 'dm' ve 'group_dm' tipleri tanımlı, guild_id NULL olur
CREATE TABLE dm_participants (
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX idx_dm_participants_user ON dm_participants(user_id);

-- 1-1 DM için uniqueness: aynı iki kullanıcıyı tekrar oluşturma
-- (basit hash: küçük_id || büyük_id biçiminde bir helper kullanıcı tarafında işlenir)

-- Arkadaşlık sistemi (Faz 3.x için altyapı)
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE friendships (
    user_a_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       friendship_status NOT NULL DEFAULT 'pending',
    requested_by BIGINT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);
CREATE INDEX idx_friendships_a ON friendships(user_a_id);
CREATE INDEX idx_friendships_b ON friendships(user_b_id);
