package handlers

import (
	"net/http"
	"strconv"

	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/repo"
	"go.uber.org/zap"
)

type openDMReq struct {
	UserID string `json:"user_id"`
}

func (h *Handler) OpenDM(w http.ResponseWriter, r *http.Request) {
	var req openDMReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	otherID, err := strconv.ParseInt(req.UserID, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user_id geçersiz")
		return
	}
	me := middleware.UserIDFrom(r.Context())
	if _, err := h.Users.ByID(r.Context(), otherID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "kullanıcı yok")
		return
	}
	channelID, err := h.DMs.OpenDirect(r.Context(), me, otherID, h.IDs.Next())
	if err != nil {
		h.logger.Error("open dm", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "dm açılamadı")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"channel_id": strconv.FormatInt(channelID, 10)})
}

func (h *Handler) ListMyDMs(w http.ResponseWriter, r *http.Request) {
	me := middleware.UserIDFrom(r.Context())
	list, err := h.DMs.ListForUser(r.Context(), me)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "dm'ler alınamadı")
		return
	}
	if list == nil {
		list = []repo.DMChannel{}
	}
	writeJSON(w, http.StatusOK, list)
}
