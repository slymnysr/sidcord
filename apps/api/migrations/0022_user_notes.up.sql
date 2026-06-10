-- Kullanıcının başka kullanıcılar hakkında tuttuğu özel notlar (sadece sahibi görür)
CREATE TABLE IF NOT EXISTS user_notes (
    owner_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note       TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, target_id)
);
