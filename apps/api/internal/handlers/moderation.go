package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/perms"
	"github.com/sidcord/api/internal/repo"
	"go.uber.org/zap"
)

type banReq struct {
	Reason string `json:"reason,omitempty"`
}

func (h *Handler) BanMember(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	requester := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, requester, perms.BanMembers, w) {
		return
	}
	g, _ := h.Guilds.ByID(r.Context(), guildID)
	if g != nil && g.OwnerID == userID {
		writeError(w, http.StatusBadRequest, "cannot_ban_owner", "sunucu sahibi banlanamaz")
		return
	}

	var req banReq
	_ = readJSON(r, &req)

	var reason *string
	if req.Reason != "" {
		reason = &req.Reason
	}
	if err := h.Moderation.Ban(r.Context(), &repo.Ban{
		GuildID:  guildID,
		UserID:   userID,
		BannedBy: requester,
		Reason:   reason,
	}); err != nil {
		h.logger.Error("ban", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "ban başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Unban(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	requester := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, requester, perms.BanMembers, w) {
		return
	}
	if err := h.Moderation.Unban(r.Context(), guildID, userID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "ban kaydı yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "unban başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListBans(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	requester := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, requester, perms.BanMembers, w) {
		return
	}
	list, err := h.Moderation.ListBans(r.Context(), guildID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "banlar alınamadı")
		return
	}
	if list == nil {
		list = []repo.Ban{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) KickMember(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	requester := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, requester, perms.KickMembers, w) {
		return
	}
	g, _ := h.Guilds.ByID(r.Context(), guildID)
	if g != nil && g.OwnerID == userID {
		writeError(w, http.StatusBadRequest, "cannot_kick_owner", "sunucu sahibi atılamaz")
		return
	}
	if err := h.Moderation.Kick(r.Context(), guildID, userID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "üye yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "kick başarısız")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type timeoutReq struct {
	DurationSec int64 `json:"duration_sec"`
}

func (h *Handler) TimeoutMember(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	requester := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, requester, perms.ModerateMembers, w) {
		return
	}
	var req timeoutReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	var until *time.Time
	if req.DurationSec > 0 {
		t := time.Now().Add(time.Duration(req.DurationSec) * time.Second)
		until = &t
	}
	if err := h.Moderation.SetTimeout(r.Context(), guildID, userID, until); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "timeout başarısız")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"timeout_until": until})
}
