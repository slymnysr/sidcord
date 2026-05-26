package repo

import (
	"context"
	"crypto/rand"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Invite struct {
	Code      string     `json:"code"`
	GuildID   int64      `json:"guild_id,string"`
	InviterID int64      `json:"inviter_id,string"`
	MaxUses   *int32     `json:"max_uses,omitempty"`
	Uses      int32      `json:"uses"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Invites struct{ pool *pgxpool.Pool }

func NewInvites(p *pgxpool.Pool) *Invites { return &Invites{pool: p} }

// 8 karakter, base32 benzeri ama daha çeşitli alfabeyle
const inviteAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

func GenerateInviteCode() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	out := make([]byte, 8)
	for i, v := range b {
		out[i] = inviteAlphabet[int(v)%len(inviteAlphabet)]
	}
	return string(out)
}

func (r *Invites) Create(ctx context.Context, inv *Invite) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO invites (code, guild_id, inviter_id, max_uses, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `, inv.Code, inv.GuildID, inv.InviterID, inv.MaxUses, inv.ExpiresAt)
	return err
}

func (r *Invites) ForGuild(ctx context.Context, guildID int64) ([]Invite, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT code, guild_id, inviter_id, max_uses, uses, expires_at, created_at
        FROM invites
        WHERE guild_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
    `, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.Code, &inv.GuildID, &inv.InviterID, &inv.MaxUses, &inv.Uses, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, inv)
	}
	return list, rows.Err()
}

func (r *Invites) Delete(ctx context.Context, code string, requesterID int64) error {
	tag, err := r.pool.Exec(ctx, `
        DELETE FROM invites
        WHERE code = $1 AND (inviter_id = $2 OR EXISTS (
            SELECT 1 FROM guilds g WHERE g.id = invites.guild_id AND g.owner_id = $2
        ))
    `, code, requesterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Invites) ByCode(ctx context.Context, code string) (*Invite, error) {
	inv := &Invite{}
	err := r.pool.QueryRow(ctx, `
        SELECT code, guild_id, inviter_id, max_uses, uses, expires_at, created_at
        FROM invites WHERE code = $1
    `, code).Scan(&inv.Code, &inv.GuildID, &inv.InviterID, &inv.MaxUses, &inv.Uses, &inv.ExpiresAt, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return inv, err
}

// AddMember + Increment uses atomik tek transaction'da
func (r *Invites) AcceptAndJoin(ctx context.Context, code string, userID int64) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var (
		guildID   int64
		maxUses   *int32
		uses      int32
		expiresAt *time.Time
	)
	err = tx.QueryRow(ctx, `
        SELECT guild_id, max_uses, uses, expires_at FROM invites WHERE code = $1 FOR UPDATE
    `, code).Scan(&guildID, &maxUses, &uses, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}

	if expiresAt != nil && time.Now().After(*expiresAt) {
		return 0, errors.New("invite_expired")
	}
	if maxUses != nil && uses >= *maxUses {
		return 0, errors.New("invite_exhausted")
	}

	// Üye ekle (zaten üyeyse hata vermez)
	_, err = tx.Exec(ctx, `
        INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
        ON CONFLICT (guild_id, user_id) DO NOTHING
    `, guildID, userID)
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(ctx, `UPDATE invites SET uses = uses + 1 WHERE code = $1`, code)
	if err != nil {
		return 0, err
	}

	return guildID, tx.Commit(ctx)
}
