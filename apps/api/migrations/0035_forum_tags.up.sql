-- Forum etiketleri: bir forum kanalının kullanılabilir etiketleri + thread'lere uygulananlar
CREATE TABLE IF NOT EXISTS forum_tags (
    id          BIGINT PRIMARY KEY,
    channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    emoji       TEXT,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_tags_channel ON forum_tags(channel_id);

CREATE TABLE IF NOT EXISTS thread_tags (
    thread_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    tag_id      BIGINT NOT NULL REFERENCES forum_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (thread_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_tags_thread ON thread_tags(thread_id);
