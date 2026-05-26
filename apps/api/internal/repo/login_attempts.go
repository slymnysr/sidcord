package repo

import (
	"context"
	"net"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LoginAttempts struct{ pool *pgxpool.Pool }

func NewLoginAttempts(p *pgxpool.Pool) *LoginAttempts { return &LoginAttempts{pool: p} }

func (r *LoginAttempts) Record(ctx context.Context, id int64, email string, ip net.IP, success bool) error {
	var ipVal any
	if ip != nil {
		ipVal = ip.String()
	}
	_, err := r.pool.Exec(ctx, `
        INSERT INTO login_attempts (id, email, ip, success)
        VALUES ($1, $2, $3, $4)
    `, id, email, ipVal, success)
	return err
}

// RecentFailures — son `window` dakika içindeki başarısız giriş sayısı (e-posta + ip bazlı toplam)
func (r *LoginAttempts) RecentFailures(ctx context.Context, email string, ip net.IP, window time.Duration) (int, error) {
	cutoff := time.Now().Add(-window)
	var n int

	if ip != nil {
		err := r.pool.QueryRow(ctx, `
            SELECT count(*) FROM login_attempts
            WHERE success = FALSE
              AND created_at > $1
              AND (email = $2 OR ip = $3::inet)
        `, cutoff, email, ip.String()).Scan(&n)
		return n, err
	}
	err := r.pool.QueryRow(ctx, `
        SELECT count(*) FROM login_attempts
        WHERE success = FALSE AND created_at > $1 AND email = $2
    `, cutoff, email).Scan(&n)
	return n, err
}
