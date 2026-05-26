package repo

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Member struct {
	UserID      int64     `json:"user_id,string"`
	GuildID     int64     `json:"guild_id,string"`
	Nickname    *string   `json:"nickname,omitempty"`
	JoinedAt    time.Time `json:"joined_at"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarColor string    `json:"avatar_color"`
	Status      string    `json:"status"`
	Bot         bool      `json:"bot"`
}

type Members struct{ pool *pgxpool.Pool }

func NewMembers(p *pgxpool.Pool) *Members { return &Members{pool: p} }

func (r *Members) ForGuild(ctx context.Context, guildID int64) ([]Member, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT m.user_id, m.guild_id, m.nickname, m.joined_at,
               u.username, u.display_name, u.avatar_color, u.status, u.bot
        FROM guild_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.guild_id = $1
        ORDER BY u.display_name ASC
    `, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.GuildID, &m.Nickname, &m.JoinedAt,
			&m.Username, &m.DisplayName, &m.AvatarColor, &m.Status, &m.Bot); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
}
