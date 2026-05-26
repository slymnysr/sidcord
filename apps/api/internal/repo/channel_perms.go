package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ChannelOverwrite struct {
	ChannelID  int64  `json:"channel_id,string"`
	TargetType string `json:"target_type"` // 'role' veya 'user'
	TargetID   int64  `json:"target_id,string"`
	Allow      int64  `json:"allow,string"`
	Deny       int64  `json:"deny,string"`
}

type ChannelPerms struct{ pool *pgxpool.Pool }

func NewChannelPerms(p *pgxpool.Pool) *ChannelPerms { return &ChannelPerms{pool: p} }

func (r *ChannelPerms) ForChannel(ctx context.Context, channelID int64) ([]ChannelOverwrite, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT channel_id, target_type::text, target_id, allow, deny
        FROM channel_overwrites WHERE channel_id = $1
    `, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []ChannelOverwrite
	for rows.Next() {
		var o ChannelOverwrite
		if err := rows.Scan(&o.ChannelID, &o.TargetType, &o.TargetID, &o.Allow, &o.Deny); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, rows.Err()
}

func (r *ChannelPerms) Upsert(ctx context.Context, o *ChannelOverwrite) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO channel_overwrites (channel_id, target_type, target_id, allow, deny)
        VALUES ($1, $2::channel_overwrite_target, $3, $4, $5)
        ON CONFLICT (channel_id, target_type, target_id)
        DO UPDATE SET allow = EXCLUDED.allow, deny = EXCLUDED.deny
    `, o.ChannelID, o.TargetType, o.TargetID, o.Allow, o.Deny)
	return err
}

func (r *ChannelPerms) Delete(ctx context.Context, channelID int64, targetType string, targetID int64) error {
	_, err := r.pool.Exec(ctx, `
        DELETE FROM channel_overwrites
        WHERE channel_id = $1 AND target_type = $2::channel_overwrite_target AND target_id = $3
    `, channelID, targetType, targetID)
	return err
}
