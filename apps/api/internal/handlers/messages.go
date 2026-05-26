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
	"go.uber.org/zap"
)

type createMessageReq struct {
	Content     string                  `json:"content"`
	RepliedToID string                  `json:"replied_to_id,omitempty"`
	Attachments []createAttachmentInput `json:"attachments,omitempty"`
}

type createAttachmentInput struct {
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
}

func (h *Handler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	channelID, err := parseID(r, "channelID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "channel id geçersiz")
		return
	}
	var req createMessageReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if (len(req.Content) == 0 && len(req.Attachments) == 0) || len(req.Content) > 4000 {
		writeError(w, http.StatusBadRequest, "invalid_content", "mesaj boş olamaz, en fazla 4000 karakter")
		return
	}
	uid := middleware.UserIDFrom(r.Context())

	// Kanal kontrolü + üyelik kontrolü
	ch, err := h.Channels.ByID(r.Context(), channelID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "kanal yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "kanal alınamadı")
		return
	}
	if ch.GuildID == nil {
		ok, _ := h.DMs.IsParticipant(r.Context(), ch.ID, uid)
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden", "bu DM'e mesaj atamazsın")
			return
		}
	} else {
		ok, _ := h.Guilds.IsMember(r.Context(), *ch.GuildID, uid)
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden", "bu kanala mesaj atamazsın")
			return
		}
		chanPerms, err := h.computeChannelPerms(r.Context(), *ch.GuildID, ch.ID, uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "izin kontrol")
			return
		}
		if !perms.Has(chanPerms, perms.SendMessages) {
			writeError(w, http.StatusForbidden, "missing_permission", "bu kanala mesaj atma izni yok")
			return
		}

		// Slowmode enforcement (ManageMessages izni varsa muaf)
		if ch.RateLimitSec > 0 && !perms.Has(chanPerms, perms.ManageMessages) {
			var lastAt *time.Time
			err := h.Pool.QueryRow(r.Context(), `
                SELECT last_at FROM channel_user_throttle WHERE channel_id = $1 AND user_id = $2
            `, ch.ID, uid).Scan(&lastAt)
			if err == nil && lastAt != nil {
				elapsed := time.Since(*lastAt).Seconds()
				remaining := float64(ch.RateLimitSec) - elapsed
				if remaining > 0 {
					w.Header().Set("Retry-After", strconv.Itoa(int(remaining)+1))
					writeError(w, http.StatusTooManyRequests, "slowmode",
						"bu kanalda yavaş modu açık; "+strconv.Itoa(int(remaining)+1)+" sn sonra tekrar dene")
					return
				}
			}
			_, _ = h.Pool.Exec(r.Context(), `
                INSERT INTO channel_user_throttle (channel_id, user_id, last_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (channel_id, user_id) DO UPDATE SET last_at = NOW()
            `, ch.ID, uid)
		}
	}

	// Reply parent kontrolü
	var repliedToID *int64
	if req.RepliedToID != "" {
		rid, err := strconv.ParseInt(req.RepliedToID, 10, 64)
		if err == nil {
			parent, perr := h.Messages.ByID(r.Context(), rid)
			if perr == nil && parent.ChannelID == channelID {
				repliedToID = &rid
			}
		}
	}

	m := &repo.Message{
		ID:          h.IDs.Next(),
		ChannelID:   channelID,
		AuthorID:    uid,
		Content:     req.Content,
		CreatedAt:   time.Now(),
		RepliedToID: repliedToID,
	}
	if err := h.Messages.Create(r.Context(), m); err != nil {
		h.logger.Error("message create", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "mesaj kaydedilemedi")
		return
	}

	// Attachment'ları ekle
	for _, a := range req.Attachments {
		if a.URL == "" || a.Filename == "" {
			continue
		}
		ct := a.ContentType
		var ctp *string
		if ct != "" {
			ctp = &ct
		}
		_ = h.Attachments.Create(r.Context(), &repo.Attachment{
			ID:          h.IDs.Next(),
			MessageID:   m.ID,
			Filename:    a.Filename,
			URL:         a.URL,
			ContentType: ctp,
			SizeBytes:   a.SizeBytes,
		})
	}

	// Mention parse + bildirim
	h.parseAndPersistMentions(r.Context(), ch, m)

	h.publishMessage(r.Context(), ch, m)

	writeJSON(w, http.StatusCreated, m)
}

func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	channelID, err := parseID(r, "channelID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "channel id geçersiz")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	ch, err := h.Channels.ByID(r.Context(), channelID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "kanal yok")
		return
	}
	if ch.GuildID != nil {
		ok, _ := h.Guilds.IsMember(r.Context(), *ch.GuildID, uid)
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
			return
		}
		chanPerms, err := h.computeChannelPerms(r.Context(), *ch.GuildID, ch.ID, uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "izin kontrol")
			return
		}
		if !perms.Has(chanPerms, perms.ViewChannel) {
			writeError(w, http.StatusForbidden, "missing_permission", "bu kanalı göremezsin")
			return
		}
	} else {
		ok, _ := h.DMs.IsParticipant(r.Context(), ch.ID, uid)
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden", "bu DM'in katılımcısı değilsin")
			return
		}
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	list, err := h.Messages.ListByChannel(r.Context(), channelID, before, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "mesajlar alınamadı")
		return
	}
	if list == nil {
		list = []repo.Message{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) publishMessage(ctx context.Context, ch *repo.Channel, m *repo.Message) {
	if h.Redis == nil {
		return
	}
	author, _ := h.Users.ByID(ctx, m.AuthorID)
	base := map[string]any{
		"type":       "MESSAGE_CREATE",
		"channel_id": strconv.FormatInt(ch.ID, 10),
		"message":    m,
		"author":     author,
		"ts":         time.Now().UnixMilli(),
	}
	if ch.GuildID != nil {
		base["guild_id"] = strconv.FormatInt(*ch.GuildID, 10)
		payload, _ := json.Marshal(base)
		topic := "sidcord:guild:" + strconv.FormatInt(*ch.GuildID, 10)
		_, _ = h.Redis.Publish(ctx, topic, payload).Result()
		return
	}
	// DM — her katılımcıya user topic'iyle yayınla
	payload, _ := json.Marshal(base)
	rows, err := h.Pool.Query(ctx, `SELECT user_id FROM dm_participants WHERE channel_id = $1`, ch.ID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil {
			_, _ = h.Redis.Publish(ctx, "sidcord:user:"+strconv.FormatInt(uid, 10), payload).Result()
		}
	}
}
