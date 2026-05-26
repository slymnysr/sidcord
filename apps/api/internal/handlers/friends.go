package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/repo"
	"go.uber.org/zap"
)

type friendReq struct {
	Username string `json:"username,omitempty"`
	UserID   string `json:"user_id,omitempty"`
}

func (h *Handler) SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	var req friendReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	uid := middleware.UserIDFrom(r.Context())

	var target int64
	if req.UserID != "" {
		v, err := strconv.ParseInt(req.UserID, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "user_id parse")
			return
		}
		target = v
	} else if req.Username != "" {
		// kullanıcı adından çöz
		var id int64
		err := h.Pool.QueryRow(r.Context(),
			`SELECT id FROM users WHERE lower(username) = lower($1)`,
			strings.TrimSpace(req.Username),
		).Scan(&id)
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", "kullanıcı yok")
			return
		}
		target = id
	} else {
		writeError(w, http.StatusBadRequest, "bad_request", "username veya user_id gerekli")
		return
	}

	if target == uid {
		writeError(w, http.StatusBadRequest, "self", "kendine istek atamazsın")
		return
	}
	if err := h.Friends.SendRequest(r.Context(), uid, target); err != nil {
		h.logger.Error("friend send", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "istek gönderilemedi")
		return
	}
	// Hedef kullanıcıya friend_request bildirimi
	_ = h.Notifications.Create(r.Context(), &repo.Notification{
		ID:      h.IDs.Next(),
		UserID:  target,
		Type:    "friend_request",
		ActorID: &uid,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AcceptFriend(w http.ResponseWriter, r *http.Request) {
	otherID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if err := h.Friends.Accept(r.Context(), uid, otherID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "istek yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "kabul edilemedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	otherID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if err := h.Friends.Remove(r.Context(), uid, otherID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "silinmedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListFriends(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	list, err := h.Friends.ListForUser(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "alınamadı")
		return
	}
	if list == nil {
		list = []repo.FriendView{}
	}
	writeJSON(w, http.StatusOK, list)
}
