package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Message struct {
	ID              int64        `json:"id,string"`
	ChannelID       int64        `json:"channel_id,string"`
	AuthorID        int64        `json:"author_id,string"`
	Content         string       `json:"content"`
	EditedAt        *time.Time   `json:"edited_at,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
	RepliedToID     *int64       `json:"replied_to_id,string,omitempty"`
	MentionEveryone bool         `json:"mention_everyone,omitempty"`
	Attachments     []Attachment `json:"attachments,omitempty"`
}

type Messages struct{ pool *pgxpool.Pool }

func NewMessages(p *pgxpool.Pool) *Messages { return &Messages{pool: p} }

func (r *Messages) Create(ctx context.Context, m *Message) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO messages (id, channel_id, author_id, content, replied_to_id)
        VALUES ($1, $2, $3, $4, $5)
    `, m.ID, m.ChannelID, m.AuthorID, m.Content, m.RepliedToID)
	return err
}

func (r *Messages) ByID(ctx context.Context, id int64) (*Message, error) {
	m := &Message{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, channel_id, author_id, content, edited_at, created_at, replied_to_id, mention_everyone
        FROM messages WHERE id = $1
    `, id).Scan(&m.ID, &m.ChannelID, &m.AuthorID, &m.Content, &m.EditedAt, &m.CreatedAt, &m.RepliedToID, &m.MentionEveryone)
	return m, err
}

func (r *Messages) UpdateContent(ctx context.Context, id, authorID int64, content string) error {
	tag, err := r.pool.Exec(ctx, `
        UPDATE messages SET content = $3, edited_at = NOW()
        WHERE id = $1 AND author_id = $2
    `, id, authorID, content)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Messages) Delete(ctx context.Context, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM messages WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListByChannel — id < before sayfalama (yeniden eskiye), Discord patterni
func (r *Messages) ListByChannel(ctx context.Context, channelID int64, before int64, limit int) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	args := []any{channelID, limit}
	q := `
        SELECT id, channel_id, author_id, content, edited_at, created_at, replied_to_id, mention_everyone
        FROM messages
        WHERE channel_id = $1
    `
	if before > 0 {
		q += ` AND id < $3`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT $2`

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Message
	idIndex := map[int64]int{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ChannelID, &m.AuthorID, &m.Content, &m.EditedAt, &m.CreatedAt, &m.RepliedToID, &m.MentionEveryone); err != nil {
			return nil, err
		}
		idIndex[m.ID] = len(list)
		list = append(list, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return list, nil
	}

	// Attachment'ları toplu çek
	ids := make([]int64, 0, len(list))
	for _, m := range list {
		ids = append(ids, m.ID)
	}
	attRows, err := r.pool.Query(ctx, `
        SELECT id, message_id, filename, url, content_type, size_bytes, created_at
        FROM attachments WHERE message_id = ANY($1)
    `, ids)
	if err != nil {
		return list, nil // attachment hatası mesajları engellemesin
	}
	defer attRows.Close()
	for attRows.Next() {
		var a Attachment
		if err := attRows.Scan(&a.ID, &a.MessageID, &a.Filename, &a.URL, &a.ContentType, &a.SizeBytes, &a.CreatedAt); err != nil {
			continue
		}
		if i, ok := idIndex[a.MessageID]; ok {
			list[i].Attachments = append(list[i].Attachments, a)
		}
	}
	return list, nil
}
