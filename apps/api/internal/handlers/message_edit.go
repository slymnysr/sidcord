package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/perms"
	"github.com/sidcord/api/internal/repo"
)

type editMessageReq struct {
	Content string `json:"content"`
}

func (h *Handler) EditMessage(w http.ResponseWriter, r *http.Request) {
	messageID, err := parseID(r, "messageID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())

	m, err := h.Messages.ByID(r.Context(), messageID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "mesaj yok")
		return
	}
	if m.AuthorID != uid {
		writeError(w, http.StatusForbidden, "forbidden", "sadece kendi mesajını düzenleyebilirsin")
		return
	}
	var req editMessageReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if len(req.Content) == 0 || len(req.Content) > 4000 {
		writeError(w, http.StatusBadRequest, "invalid_content", "1-4000 karakter")
		return
	}
	if err := h.Messages.UpdateContent(r.Context(), messageID, uid, req.Content); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "güncellenmedi")
		return
	}
	m.Content = req.Content
	now := time.Now()
	m.EditedAt = &now

	ch, _ := h.Channels.ByID(r.Context(), m.ChannelID)
	if ch != nil {
		h.publishMessageEvent(r.Context(), ch, m, "MESSAGE_UPDATE")
	}
	writeJSON(w, http.StatusOK, m)
}

func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	messageID, err := parseID(r, "messageID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	m, err := h.Messages.ByID(r.Context(), messageID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "mesaj yok")
		return
	}
	ch, err := h.Channels.ByID(r.Context(), m.ChannelID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "kanal yok")
		return
	}

	// Yetki: kendi mesajıysa OK; değilse ManageMessages gerekiyor (sadece guild)
	if m.AuthorID != uid {
		if ch.GuildID == nil {
			writeError(w, http.StatusForbidden, "forbidden", "yetersiz")
			return
		}
		cp, err := h.computeChannelPerms(r.Context(), *ch.GuildID, ch.ID, uid)
		if err != nil || !perms.Has(cp, perms.ManageMessages) {
			writeError(w, http.StatusForbidden, "missing_permission", "yetersiz izin")
			return
		}
	}
	if err := h.Messages.Delete(r.Context(), messageID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "mesaj yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "silinemedi")
		return
	}
	h.publishMessageEvent(r.Context(), ch, m, "MESSAGE_DELETE")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) publishMessageEvent(ctx context.Context, ch *repo.Channel, m *repo.Message, eventType string) {
	if h.Redis == nil {
		return
	}
	base := map[string]any{
		"type":       eventType,
		"channel_id": strconv.FormatInt(ch.ID, 10),
		"message":    m,
		"ts":         time.Now().UnixMilli(),
	}
	if ch.GuildID != nil {
		base["guild_id"] = strconv.FormatInt(*ch.GuildID, 10)
		payload, _ := json.Marshal(base)
		h.Redis.Publish(ctx, "sidcord:guild:"+strconv.FormatInt(*ch.GuildID, 10), payload)
		return
	}
	payload, _ := json.Marshal(base)
	rows, err := h.Pool.Query(ctx, `SELECT user_id FROM dm_participants WHERE channel_id = $1`, ch.ID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil {
			h.Redis.Publish(ctx, "sidcord:user:"+strconv.FormatInt(uid, 10), payload)
		}
	}
}
