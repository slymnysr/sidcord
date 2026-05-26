package handlers

import (
	"net/http"
	"time"

	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/perms"
)

type eventView struct {
	ID               string    `json:"id"`
	GuildID          string    `json:"guild_id"`
	ChannelID        *string   `json:"channel_id,omitempty"`
	CreatorID        string    `json:"creator_id"`
	Name             string    `json:"name"`
	Description      *string   `json:"description,omitempty"`
	ScheduledStartAt time.Time `json:"scheduled_start_at"`
	ScheduledEndAt   *time.Time `json:"scheduled_end_at,omitempty"`
	EntityType       string    `json:"entity_type"`
	EntityLocation   *string   `json:"entity_location,omitempty"`
	Status           string    `json:"status"`
	ImageURL         *string   `json:"image_url,omitempty"`
	SubscriberCount  int       `json:"subscriber_count"`
	Subscribed       bool      `json:"subscribed"`
	CreatedAt        time.Time `json:"created_at"`
}

type createEventReq struct {
	ChannelID        string  `json:"channel_id,omitempty"`
	Name             string  `json:"name"`
	Description      string  `json:"description,omitempty"`
	ScheduledStartAt string  `json:"scheduled_start_at"`
	ScheduledEndAt   string  `json:"scheduled_end_at,omitempty"`
	EntityType       string  `json:"entity_type"` // 'voice'|'stage_instance'|'external'
	EntityLocation   string  `json:"entity_location,omitempty"`
	ImageURL         string  `json:"image_url,omitempty"`
}

// POST /api/v1/guilds/:id/events
func (h *Handler) CreateGuildEvent(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "guild id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageGuild, w) {
		return
	}
	var req createEventReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if req.Name == "" || len(req.Name) > 100 {
		writeError(w, http.StatusBadRequest, "invalid_name", "1-100 karakter")
		return
	}
	if req.EntityType != "voice" && req.EntityType != "stage_instance" && req.EntityType != "external" {
		writeError(w, http.StatusBadRequest, "invalid_entity_type", "voice|stage_instance|external")
		return
	}
	start, err := time.Parse(time.RFC3339, req.ScheduledStartAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "scheduled_start_at RFC3339")
		return
	}
	var end *time.Time
	if req.ScheduledEndAt != "" {
		t, err := time.Parse(time.RFC3339, req.ScheduledEndAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "scheduled_end_at RFC3339")
			return
		}
		end = &t
	}
	var channelID *int64
	if req.ChannelID != "" && req.EntityType != "external" {
		v, err := parseInt64(req.ChannelID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "channel_id")
			return
		}
		channelID = &v
	}
	if req.EntityType == "external" && req.EntityLocation == "" {
		writeError(w, http.StatusBadRequest, "missing_location", "external etkinlik için yer gerekli")
		return
	}

	id := h.IDs.Next()
	var descPtr, locPtr, imgPtr *string
	if req.Description != "" {
		descPtr = &req.Description
	}
	if req.EntityLocation != "" {
		locPtr = &req.EntityLocation
	}
	if req.ImageURL != "" {
		imgPtr = &req.ImageURL
	}
	_, err = h.Pool.Exec(r.Context(), `
        INSERT INTO guild_events (id, guild_id, channel_id, creator_id, name, description,
            scheduled_start_at, scheduled_end_at, entity_type, entity_location, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::event_entity_type, $10, $11)
    `, id, guildID, channelID, uid, req.Name, descPtr, start, end, req.EntityType, locPtr, imgPtr)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "yazılamadı: "+err.Error())
		return
	}
	v := eventView{
		ID: int64ToStr(id), GuildID: int64ToStr(guildID), CreatorID: int64ToStr(uid),
		Name: req.Name, Description: descPtr, ScheduledStartAt: start, ScheduledEndAt: end,
		EntityType: req.EntityType, EntityLocation: locPtr, Status: "scheduled", ImageURL: imgPtr,
		CreatedAt: time.Now(),
	}
	if channelID != nil {
		s := int64ToStr(*channelID)
		v.ChannelID = &s
	}
	h.Events.ToGuild(r.Context(), guildID, "GUILD_EVENT_CREATE", map[string]any{"event": v})
	writeJSON(w, http.StatusCreated, v)
}

// GET /api/v1/guilds/:id/events
func (h *Handler) ListGuildEvents(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "guild id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if ok, _ := h.Guilds.IsMember(r.Context(), guildID, uid); !ok {
		writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
		return
	}
	rows, err := h.Pool.Query(r.Context(), `
        SELECT e.id::text, e.guild_id::text, e.channel_id::text, e.creator_id::text,
               e.name, e.description, e.scheduled_start_at, e.scheduled_end_at,
               e.entity_type::text, e.entity_location, e.status::text, e.image_url, e.created_at,
               COALESCE((SELECT count(*) FROM guild_event_subscribers s WHERE s.event_id = e.id), 0) AS subs,
               EXISTS(SELECT 1 FROM guild_event_subscribers s WHERE s.event_id = e.id AND s.user_id = $2) AS subscribed
        FROM guild_events e
        WHERE e.guild_id = $1 AND e.status IN ('scheduled', 'active')
        ORDER BY e.scheduled_start_at ASC
    `, guildID, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []eventView{}
	for rows.Next() {
		var v eventView
		if err := rows.Scan(&v.ID, &v.GuildID, &v.ChannelID, &v.CreatorID, &v.Name,
			&v.Description, &v.ScheduledStartAt, &v.ScheduledEndAt, &v.EntityType,
			&v.EntityLocation, &v.Status, &v.ImageURL, &v.CreatedAt,
			&v.SubscriberCount, &v.Subscribed); err != nil {
			continue
		}
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, out)
}

// DELETE /api/v1/events/:id
func (h *Handler) DeleteGuildEvent(w http.ResponseWriter, r *http.Request) {
	eventID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	var guildID int64
	if err := h.Pool.QueryRow(r.Context(), `SELECT guild_id FROM guild_events WHERE id = $1`, eventID).Scan(&guildID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "etkinlik yok")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageGuild, w) {
		return
	}
	_, _ = h.Pool.Exec(r.Context(), `DELETE FROM guild_events WHERE id = $1`, eventID)
	h.Events.ToGuild(r.Context(), guildID, "GUILD_EVENT_DELETE", map[string]any{"event_id": int64ToStr(eventID)})
	w.WriteHeader(http.StatusNoContent)
}

// PUT /api/v1/events/:id/subscribers/me
func (h *Handler) SubscribeEvent(w http.ResponseWriter, r *http.Request) {
	eventID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	var guildID int64
	if err := h.Pool.QueryRow(r.Context(), `SELECT guild_id FROM guild_events WHERE id = $1`, eventID).Scan(&guildID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "etkinlik yok")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if ok, _ := h.Guilds.IsMember(r.Context(), guildID, uid); !ok {
		writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
		return
	}
	_, _ = h.Pool.Exec(r.Context(), `
        INSERT INTO guild_event_subscribers (event_id, user_id) VALUES ($1, $2)
        ON CONFLICT DO NOTHING
    `, eventID, uid)
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/v1/events/:id/subscribers/me
func (h *Handler) UnsubscribeEvent(w http.ResponseWriter, r *http.Request) {
	eventID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	_, _ = h.Pool.Exec(r.Context(), `DELETE FROM guild_event_subscribers WHERE event_id = $1 AND user_id = $2`, eventID, uid)
	w.WriteHeader(http.StatusNoContent)
}
