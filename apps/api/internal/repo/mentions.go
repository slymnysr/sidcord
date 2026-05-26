package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Mentions struct{ pool *pgxpool.Pool }

func NewMentions(p *pgxpool.Pool) *Mentions { return &Mentions{pool: p} }

func (r *Mentions) Add(ctx context.Context, messageID int64, userIDs []int64) error {
	if len(userIDs) == 0 {
		return nil
	}
	rows := make([][]any, 0, len(userIDs))
	for _, uid := range userIDs {
		rows = append(rows, []any{messageID, uid})
	}
	// pgx CopyFrom yok, basit loop
	for _, uid := range userIDs {
		_, err := r.pool.Exec(ctx, `
            INSERT INTO message_mentions (message_id, user_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        `, messageID, uid)
		if err != nil {
			return err
		}
	}
	_ = rows
	return nil
}

type Notification struct {
	ID         int64      `json:"id,string"`
	UserID     int64      `json:"user_id,string"`
	Type       string     `json:"type"`
	ChannelID  *int64     `json:"channel_id,string,omitempty"`
	GuildID    *int64     `json:"guild_id,string,omitempty"`
	MessageID  *int64     `json:"message_id,string,omitempty"`
	ActorID    *int64     `json:"actor_id,string,omitempty"`
	ReadAt     *time.Time `json:"read_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type Notifications struct{ pool *pgxpool.Pool }

func NewNotifications(p *pgxpool.Pool) *Notifications { return &Notifications{pool: p} }

func (r *Notifications) Create(ctx context.Context, n *Notification) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO notifications (id, user_id, type, channel_id, guild_id, message_id, actor_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, n.ID, n.UserID, n.Type, n.ChannelID, n.GuildID, n.MessageID, n.ActorID)
	return err
}

func (r *Notifications) ListUnread(ctx context.Context, userID int64, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
        SELECT id, user_id, type, channel_id, guild_id, message_id, actor_id, read_at, created_at
        FROM notifications WHERE user_id = $1 AND read_at IS NULL
        ORDER BY created_at DESC LIMIT $2
    `, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.ChannelID, &n.GuildID, &n.MessageID, &n.ActorID, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (r *Notifications) MarkRead(ctx context.Context, userID int64, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
        UPDATE notifications SET read_at = NOW()
        WHERE user_id = $1 AND id = ANY($2) AND read_at IS NULL
    `, userID, ids)
	return err
}

func (r *Notifications) MarkAllRead(ctx context.Context, userID int64) error {
	_, err := r.pool.Exec(ctx, `
        UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL
    `, userID)
	return err
}

func (r *Notifications) Unread(ctx context.Context, userID int64) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
        SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL
    `, userID).Scan(&n)
	return n, err
}
