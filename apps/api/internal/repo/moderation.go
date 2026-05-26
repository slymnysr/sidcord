package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Ban struct {
	GuildID  int64     `json:"guild_id,string"`
	UserID   int64     `json:"user_id,string"`
	BannedBy int64     `json:"banned_by,string"`
	Reason   *string   `json:"reason,omitempty"`
	BannedAt time.Time `json:"banned_at"`
}

type Moderation struct{ pool *pgxpool.Pool }

func NewModeration(p *pgxpool.Pool) *Moderation { return &Moderation{pool: p} }

func (r *Moderation) Ban(ctx context.Context, b *Ban) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
        INSERT INTO guild_bans (guild_id, user_id, banned_by, reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id, user_id) DO UPDATE
        SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason, banned_at = NOW()
    `, b.GuildID, b.UserID, b.BannedBy, b.Reason)
	if err != nil {
		return err
	}
	// Üyeliği kaldır
	_, err = tx.Exec(ctx, `DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`, b.GuildID, b.UserID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Moderation) Unban(ctx context.Context, guildID, userID int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM guild_bans WHERE guild_id = $1 AND user_id = $2`, guildID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Moderation) IsBanned(ctx context.Context, guildID, userID int64) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
        SELECT EXISTS(SELECT 1 FROM guild_bans WHERE guild_id = $1 AND user_id = $2)
    `, guildID, userID).Scan(&exists)
	return exists, err
}

func (r *Moderation) ListBans(ctx context.Context, guildID int64) ([]Ban, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT guild_id, user_id, banned_by, reason, banned_at
        FROM guild_bans WHERE guild_id = $1 ORDER BY banned_at DESC
    `, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Ban
	for rows.Next() {
		var b Ban
		if err := rows.Scan(&b.GuildID, &b.UserID, &b.BannedBy, &b.Reason, &b.BannedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, rows.Err()
}

func (r *Moderation) Kick(ctx context.Context, guildID, userID int64) error {
	tag, err := r.pool.Exec(ctx, `
        DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2
    `, guildID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Moderation) SetTimeout(ctx context.Context, guildID, userID int64, until *time.Time) error {
	tag, err := r.pool.Exec(ctx, `
        UPDATE guild_members SET timeout_until = $3
        WHERE guild_id = $1 AND user_id = $2
    `, guildID, userID, until)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Moderation) ActiveTimeout(ctx context.Context, guildID, userID int64) (*time.Time, error) {
	var until *time.Time
	err := r.pool.QueryRow(ctx, `
        SELECT timeout_until FROM guild_members
        WHERE guild_id = $1 AND user_id = $2 AND timeout_until IS NOT NULL AND timeout_until > NOW()
    `, guildID, userID).Scan(&until)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return until, err
}
