package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sidcord/api/internal/middleware"
)

type updateStatusReq struct {
	Status            string  `json:"status,omitempty"`
	CustomStatusText  *string `json:"custom_status_text,omitempty"`
	CustomStatusEmoji *string `json:"custom_status_emoji,omitempty"`
}

func (h *Handler) UpdateMyStatus(w http.ResponseWriter, r *http.Request) {
	var req updateStatusReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if req.Status != "" {
		switch req.Status {
		case "online", "idle", "dnd", "offline":
		default:
			writeError(w, http.StatusBadRequest, "invalid_status", "geçersiz durum")
			return
		}
		if _, err := h.Pool.Exec(r.Context(), `UPDATE users SET status = $1 WHERE id = $2`, req.Status, uid); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "güncellenemedi")
			return
		}
	}
	if req.CustomStatusText != nil {
		_, _ = h.Pool.Exec(r.Context(), `UPDATE users SET custom_status_text = $1 WHERE id = $2`, *req.CustomStatusText, uid)
	}
	if req.CustomStatusEmoji != nil {
		_, _ = h.Pool.Exec(r.Context(), `UPDATE users SET custom_status_emoji = $1 WHERE id = $2`, *req.CustomStatusEmoji, uid)
	}
	w.WriteHeader(http.StatusNoContent)
}

// Genel kullanıcı profili — username, display_name, avatar_color/url, bio, status, bot, created_at
type mutualGuildView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IconColor string `json:"icon_color"`
	IconText  string `json:"icon_text"`
}

type mutualFriendView struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	AvatarColor string `json:"avatar_color"`
}

type publicUserView struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarColor string    `json:"avatar_color"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	BannerURL   *string   `json:"banner_url,omitempty"`
	Bio         *string   `json:"bio,omitempty"`
	Status      string    `json:"status"`
	Bot         bool      `json:"bot"`
	CreatedAt   time.Time `json:"created_at"`
	// Friendship state with the requesting user (none / pending_sent / pending_received / accepted / self)
	FriendshipState string `json:"friendship_state,omitempty"`
	// Has open DM with the requesting user
	DMChannelID   *string            `json:"dm_channel_id,omitempty"`
	MutualGuilds  []mutualGuildView  `json:"mutual_guilds,omitempty"`
	MutualFriends []mutualFriendView `json:"mutual_friends,omitempty"`
}

func (h *Handler) GetUserPublic(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "userID")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id geçersiz")
		return
	}
	requester := middleware.UserIDFrom(r.Context())

	var v publicUserView
	err = h.Pool.QueryRow(r.Context(), `
        SELECT id::text, username, display_name, avatar_color, avatar_url,
               banner_url, bio, status, bot, created_at
        FROM users WHERE id = $1
    `, id).Scan(&v.ID, &v.Username, &v.DisplayName, &v.AvatarColor, &v.AvatarURL,
		&v.BannerURL, &v.Bio, &v.Status, &v.Bot, &v.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "kullanıcı yok")
		return
	}

	// Friendship state
	if requester == id {
		v.FriendshipState = "self"
	} else {
		a, b := requester, id
		if a > b {
			a, b = b, a
		}
		var fStatus string
		var requestedBy int64
		err := h.Pool.QueryRow(r.Context(), `
            SELECT status::text, requested_by
            FROM friendships WHERE user_a_id = $1 AND user_b_id = $2
        `, a, b).Scan(&fStatus, &requestedBy)
		if err == nil {
			switch fStatus {
			case "accepted":
				v.FriendshipState = "accepted"
			case "pending":
				if requestedBy == requester {
					v.FriendshipState = "pending_sent"
				} else {
					v.FriendshipState = "pending_received"
				}
			case "blocked":
				v.FriendshipState = "blocked"
			}
		}

		// Mevcut DM kanalı (1-1)
		var dmID int64
		err = h.Pool.QueryRow(r.Context(), `
            SELECT c.id FROM channels c
            WHERE c.type = 'dm'
              AND (SELECT count(*) FROM dm_participants p WHERE p.channel_id = c.id) = 2
              AND EXISTS (SELECT 1 FROM dm_participants WHERE channel_id = c.id AND user_id = $1)
              AND EXISTS (SELECT 1 FROM dm_participants WHERE channel_id = c.id AND user_id = $2)
            LIMIT 1
        `, requester, id).Scan(&dmID)
		if err == nil {
			dmStr := strconv.FormatInt(dmID, 10)
			v.DMChannelID = &dmStr
		}

		// Ortak sunucular
		if rows, err := h.Pool.Query(r.Context(), `
            SELECT g.id::text, g.name, g.icon_color, g.icon_text
            FROM guilds g
            JOIN guild_members m1 ON m1.guild_id = g.id AND m1.user_id = $1
            JOIN guild_members m2 ON m2.guild_id = g.id AND m2.user_id = $2
            ORDER BY g.name ASC
        `, requester, id); err == nil {
			defer rows.Close()
			v.MutualGuilds = []mutualGuildView{}
			for rows.Next() {
				var mg mutualGuildView
				if err := rows.Scan(&mg.ID, &mg.Name, &mg.IconColor, &mg.IconText); err == nil {
					v.MutualGuilds = append(v.MutualGuilds, mg)
				}
			}
		}

		// Ortak arkadaşlar (her ikisinin de 'accepted' arkadaşı olanlar)
		if rows, err := h.Pool.Query(r.Context(), `
            WITH my_friends AS (
                SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS uid
                FROM friendships
                WHERE (user_a_id = $1 OR user_b_id = $1) AND status = 'accepted'
            ),
            their_friends AS (
                SELECT CASE WHEN user_a_id = $2 THEN user_b_id ELSE user_a_id END AS uid
                FROM friendships
                WHERE (user_a_id = $2 OR user_b_id = $2) AND status = 'accepted'
            )
            SELECT u.id::text, u.display_name, u.avatar_color
            FROM users u
            WHERE u.id IN (SELECT uid FROM my_friends INTERSECT SELECT uid FROM their_friends)
            ORDER BY u.display_name
            LIMIT 20
        `, requester, id); err == nil {
			defer rows.Close()
			v.MutualFriends = []mutualFriendView{}
			for rows.Next() {
				var mf mutualFriendView
				if err := rows.Scan(&mf.UserID, &mf.DisplayName, &mf.AvatarColor); err == nil {
					v.MutualFriends = append(v.MutualFriends, mf)
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, v)
}
