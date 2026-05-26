package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sidcord/api/internal/middleware"
)

type updateStatusReq struct {
	Status string `json:"status"`
}

func (h *Handler) UpdateMyStatus(w http.ResponseWriter, r *http.Request) {
	var req updateStatusReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	switch req.Status {
	case "online", "idle", "dnd", "offline":
	default:
		writeError(w, http.StatusBadRequest, "invalid_status", "geçersiz durum")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	_, err := h.Pool.Exec(r.Context(),
		`UPDATE users SET status = $1 WHERE id = $2`, req.Status, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "güncellenemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Genel kullanıcı profili — username, display_name, avatar_color/url, bio, status, bot, created_at
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
	DMChannelID *string `json:"dm_channel_id,omitempty"`
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
	}

	writeJSON(w, http.StatusOK, v)
}
