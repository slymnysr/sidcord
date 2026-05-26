package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Channel struct {
	ID            int64     `json:"id,string"`
	GuildID       *int64    `json:"guild_id,string,omitempty"`
	ParentID      *int64    `json:"parent_id,string,omitempty"`
	Type          string    `json:"type"`
	Name          string    `json:"name"`
	Topic         *string   `json:"topic,omitempty"`
	Position      int32     `json:"position"`
	NSFW          bool      `json:"nsfw"`
	RateLimitSec  int32     `json:"rate_limit_sec"`
	CreatedAt     time.Time `json:"created_at"`
}

type Channels struct{ pool *pgxpool.Pool }

func NewChannels(p *pgxpool.Pool) *Channels { return &Channels{pool: p} }

func (r *Channels) Create(ctx context.Context, c *Channel) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO channels (id, guild_id, parent_id, type, name, topic, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, c.ID, c.GuildID, c.ParentID, c.Type, c.Name, c.Topic, c.Position)
	return err
}

func (r *Channels) ByID(ctx context.Context, id int64) (*Channel, error) {
	c := &Channel{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, guild_id, parent_id, type::text, name, topic, position, nsfw, rate_limit_sec, created_at
        FROM channels WHERE id = $1
    `, id).Scan(&c.ID, &c.GuildID, &c.ParentID, &c.Type, &c.Name, &c.Topic, &c.Position, &c.NSFW, &c.RateLimitSec, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return c, err
}

func (r *Channels) ForGuild(ctx context.Context, guildID int64) ([]Channel, error) {
	// Thread tipleri (public_thread, private_thread, news_thread) sidebar listesinde gözükmez;
	// ChannelHeader > Thread'ler paneli üzerinden açılır
	rows, err := r.pool.Query(ctx, `
        SELECT id, guild_id, parent_id, type::text, name, topic, position, nsfw, rate_limit_sec, created_at
        FROM channels WHERE guild_id = $1
          AND type::text NOT IN ('public_thread', 'private_thread', 'news_thread')
        ORDER BY position ASC, id ASC
    `, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Channel
	for rows.Next() {
		var c Channel
		if err := rows.Scan(&c.ID, &c.GuildID, &c.ParentID, &c.Type, &c.Name, &c.Topic, &c.Position, &c.NSFW, &c.RateLimitSec, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}
