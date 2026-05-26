package handlers

import (
	"net/http"

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
