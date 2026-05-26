package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Role struct {
	ID          int64     `json:"id,string"`
	GuildID     int64     `json:"guild_id,string"`
	Name        string    `json:"name"`
	Color       int32     `json:"color"`
	Position    int32     `json:"position"`
	Permissions int64     `json:"permissions,string"`
	Hoist       bool      `json:"hoist"`
	Mentionable bool      `json:"mentionable"`
	IsEveryone  bool      `json:"is_everyone"`
	CreatedAt   time.Time `json:"created_at"`
}

type Roles struct{ pool *pgxpool.Pool }

func NewRoles(p *pgxpool.Pool) *Roles { return &Roles{pool: p} }

func (r *Roles) Create(ctx context.Context, role *Role) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO roles (id, guild_id, name, color, position, permissions, hoist, mentionable, is_everyone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, role.ID, role.GuildID, role.Name, role.Color, role.Position, role.Permissions,
		role.Hoist, role.Mentionable, role.IsEveryone)
	return err
}

func (r *Roles) Update(ctx context.Context, role *Role) error {
	_, err := r.pool.Exec(ctx, `
        UPDATE roles SET name = $2, color = $3, position = $4,
                         permissions = $5, hoist = $6, mentionable = $7
        WHERE id = $1
    `, role.ID, role.Name, role.Color, role.Position, role.Permissions, role.Hoist, role.Mentionable)
	return err
}

func (r *Roles) Delete(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM roles WHERE id = $1 AND is_everyone = FALSE`, id)
	return err
}

func (r *Roles) ByID(ctx context.Context, id int64) (*Role, error) {
	role := &Role{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, guild_id, name, color, position, permissions, hoist, mentionable, is_everyone, created_at
        FROM roles WHERE id = $1
    `, id).Scan(&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Position, &role.Permissions,
		&role.Hoist, &role.Mentionable, &role.IsEveryone, &role.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return role, err
}

func (r *Roles) ForGuild(ctx context.Context, guildID int64) ([]Role, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT id, guild_id, name, color, position, permissions, hoist, mentionable, is_everyone, created_at
        FROM roles WHERE guild_id = $1
        ORDER BY position DESC, id ASC
    `, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Role
	for rows.Next() {
		var role Role
		if err := rows.Scan(&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Position,
			&role.Permissions, &role.Hoist, &role.Mentionable, &role.IsEveryone, &role.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, role)
	}
	return list, rows.Err()
}

func (r *Roles) EveryoneFor(ctx context.Context, guildID int64) (*Role, error) {
	role := &Role{}
	err := r.pool.QueryRow(ctx, `
        SELECT id, guild_id, name, color, position, permissions, hoist, mentionable, is_everyone, created_at
        FROM roles WHERE guild_id = $1 AND is_everyone = TRUE
    `, guildID).Scan(&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Position, &role.Permissions,
		&role.Hoist, &role.Mentionable, &role.IsEveryone, &role.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return role, err
}

// AssignToMember — member_roles tablosuna kayıt
func (r *Roles) AssignToMember(ctx context.Context, guildID, userID, roleID int64) error {
	_, err := r.pool.Exec(ctx, `
        INSERT INTO member_roles (guild_id, user_id, role_id) VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
    `, guildID, userID, roleID)
	return err
}

func (r *Roles) RemoveFromMember(ctx context.Context, guildID, userID, roleID int64) error {
	_, err := r.pool.Exec(ctx, `
        DELETE FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3
    `, guildID, userID, roleID)
	return err
}

// MemberRoleIDs — bir üyenin sahip olduğu rol ID'leri (everyone dahil)
func (r *Roles) MemberRoleIDs(ctx context.Context, guildID, userID int64) ([]int64, error) {
	rows, err := r.pool.Query(ctx, `
        SELECT role_id FROM member_roles WHERE guild_id = $1 AND user_id = $2
        UNION
        SELECT id FROM roles WHERE guild_id = $1 AND is_everyone = TRUE
    `, guildID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// MemberPermissions — bir üyenin sunucu seviyesindeki toplam permission bitmask'i
func (r *Roles) MemberPermissions(ctx context.Context, guildID, userID int64) (uint64, error) {
	// Owner her zaman tüm izinlere sahip
	var isOwner bool
	if err := r.pool.QueryRow(ctx, `
        SELECT owner_id = $1 FROM guilds WHERE id = $2
    `, userID, guildID).Scan(&isOwner); err != nil {
		return 0, err
	}
	if isOwner {
		return 0xFFFFFFFFFF, nil
	}

	var combined int64
	err := r.pool.QueryRow(ctx, `
        SELECT COALESCE(BIT_OR(r.permissions), 0)
        FROM roles r
        WHERE r.guild_id = $1 AND (
            r.is_everyone = TRUE
            OR r.id IN (SELECT role_id FROM member_roles WHERE guild_id = $1 AND user_id = $2)
        )
    `, guildID, userID).Scan(&combined)
	if err != nil {
		return 0, err
	}
	return uint64(combined), nil
}
