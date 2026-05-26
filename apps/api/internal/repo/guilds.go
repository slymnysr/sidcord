package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Guild struct {
	ID          int64     `json:"id,string"`
	Name        string    `json:"name"`
	IconText    string    `json:"icon_text"`
	IconColor   string    `json:"icon_color"`
	OwnerID     int64     `json:"owner_id,string"`
	Description *string   `json:"description,omitempty"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
}

type Guilds struct{ pool *pgxpool.Pool }

func NewGuilds(p *pgxpool.Pool) *Guilds { return &Guilds{pool: p} }

func (r *Guilds) Create(ctx context.Context, g *Guild) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
        INSERT INTO guilds (id, name, icon_text, icon_color, owner_id, description, is_public)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, g.ID, g.Name, g.IconText, g.IconColor, g.OwnerID, g.Description, g.IsPublic)
	if err != nil {
		return err
	}

	// Sahibi otomatik üye yap
	_, err = tx.Exec(ctx, `
        INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
    `, g.ID, g.OwnerID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Guilds) ByID(ctx context.Context, id int64) (*Guild, error) {
	g := &Guild{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, name, icon_text, icon_color, owner_id, description, is_public, created_at
        FROM guilds WHERE id = $1
    `, id).Scan(&g.ID, &g.Name, &g.IconText, &g.IconColor, &g.OwnerID, &g.Description, &g.IsPublic, &g.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return g, err
}

func (r *Guilds) ForUser(ctx context.Context, userID int64) ([]Guild, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT g.id, g.name, g.icon_text, g.icon_color, g.owner_id, g.description, g.is_public, g.created_at
        FROM guilds g
        JOIN guild_members m ON m.guild_id = g.id
        WHERE m.user_id = $1
        ORDER BY g.created_at ASC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Guild
	for rows.Next() {
		var g Guild
		if err := rows.Scan(&g.ID, &g.Name, &g.IconText, &g.IconColor, &g.OwnerID, &g.Description, &g.IsPublic, &g.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, rows.Err()
}

func (r *Guilds) IsMember(ctx context.Context, guildID, userID int64) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
        SELECT EXISTS(SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2)
    `, guildID, userID).Scan(&exists)
	return exists, err
}
