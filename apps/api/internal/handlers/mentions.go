package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/repo"
)

// @kullaniciadi formatındaki bahsetmeleri çıkar
var mentionRegex = regexp.MustCompile(`@([a-z0-9_.]{3,32})`)

// parseAndPersistMentions — mesaj içeriğindeki @ bahsetmelerini ayıklar,
// kullanıcıları çözer, mention tablosuna ekler, notification oluşturur.
func (h *Handler) parseAndPersistMentions(ctx context.Context, ch *repo.Channel, m *repo.Message) []int64 {
	matches := mentionRegex.FindAllStringSubmatch(m.Content, -1)
	if len(matches) == 0 {
		return nil
	}
	usernames := map[string]bool{}
	for _, mm := range matches {
		if len(mm) > 1 {
			usernames[strings.ToLower(mm[1])] = true
		}
	}
	if len(usernames) == 0 {
		return nil
	}
	list := make([]string, 0, len(usernames))
	for u := range usernames {
		list = append(list, u)
	}

	// Kullanıcıları çöz
	rows, err := h.Pool.Query(ctx, `SELECT id FROM users WHERE lower(username) = ANY($1)`, list)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var userIDs []int64
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil && uid != m.AuthorID {
			userIDs = append(userIDs, uid)
		}
	}
	if len(userIDs) == 0 {
		return nil
	}

	_ = h.Mentions.Add(ctx, m.ID, userIDs)

	// Notification oluştur ve user'lara redis ile yayınla
	for _, uid := range userIDs {
		n := &repo.Notification{
			ID:        h.IDs.Next(),
			UserID:    uid,
			Type:      "mention",
			ChannelID: &m.ChannelID,
			MessageID: &m.ID,
			ActorID:   &m.AuthorID,
		}
		if ch.GuildID != nil {
			n.GuildID = ch.GuildID
		}
		_ = h.Notifications.Create(ctx, n)
		if h.Redis != nil {
			payload, _ := json.Marshal(map[string]any{
				"type":         "NOTIFICATION",
				"notification": n,
				"ts":           time.Now().UnixMilli(),
			})
			_, _ = h.Redis.Publish(ctx, "sidcord:user:"+strconv.FormatInt(uid, 10), payload).Result()
		}
	}
	return userIDs
}

// === Notifications endpoints ===

func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	list, err := h.Notifications.ListUnread(r.Context(), uid, 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "bildirimler alınamadı")
		return
	}
	if list == nil {
		list = []repo.Notification{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) NotificationsCount(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	n, err := h.Notifications.Unread(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "sayım hatası")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"unread": n})
}

func (h *Handler) MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	if err := h.Notifications.MarkAllRead(r.Context(), uid); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "okundu işareti hatası")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
