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

// ListActiveForUser — kullanıcının iptal edilmemiş, süresi geçmemiş oturumları (en yeni önce).
func (r *RefreshTokens) ListActiveForUser(ctx context.Context, userID int64) ([]RefreshToken, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT id, user_id, token_hash, user_agent, expires_at, revoked_at, created_at
        FROM refresh_tokens
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []RefreshToken
	for rows.Next() {
		var t RefreshToken
		if err := rows.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.UserAgent, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

// RevokeByID — belirli bir oturumu iptal eder (yalnızca sahibinin).
func (r *RefreshTokens) RevokeByID(ctx context.Context, id, userID int64) error {
	_, err := r.pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, id, userID)
	return err
}

// RevokeAllExcept — verilen oturum hariç kullanıcının tüm oturumlarını iptal eder.
func (r *RefreshTokens) RevokeAllExcept(ctx context.Context, userID, exceptID int64) error {
	_, err := r.pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, userID, exceptID)
	return err
}
