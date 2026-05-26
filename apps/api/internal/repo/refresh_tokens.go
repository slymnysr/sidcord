package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RefreshToken struct {
	ID        int64
	UserID    int64
	TokenHash string
	UserAgent *string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}

type RefreshTokens struct{ pool *pgxpool.Pool }

func NewRefreshTokens(p *pgxpool.Pool) *RefreshTokens { return &RefreshTokens{pool: p} }

func (r *RefreshTokens) Create(ctx context.Context, t *RefreshToken) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `, t.ID, t.UserID, t.TokenHash, t.UserAgent, t.ExpiresAt)
	return err
}

func (r *RefreshTokens) ByHash(ctx context.Context, hash string) (*RefreshToken, error) {
	t := &RefreshToken{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, user_id, token_hash, user_agent, expires_at, revoked_at, created_at
        FROM refresh_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
    `, hash).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.UserAgent, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return t, err
}

func (r *RefreshTokens) Revoke(ctx context.Context, hash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, hash)
	return err
}
