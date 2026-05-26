package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/perms"
	"github.com/sidcord/api/internal/repo"
	"go.uber.org/zap"
)

type createGuildReq struct {
	Name      string `json:"name"`
	IconText  string `json:"icon_text,omitempty"`
	IconColor string `json:"icon_color,omitempty"`
}

func (h *Handler) CreateGuild(w http.ResponseWriter, r *http.Request) {
	var req createGuildReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 64 {
		writeError(w, http.StatusBadRequest, "invalid_name", "sunucu adı 2-64 karakter olmalı")
		return
	}
	if req.IconText == "" {
		req.IconText = strings.ToUpper(req.Name[:1])
		if len(req.Name) >= 2 {
			req.IconText = strings.ToUpper(req.Name[:2])
		}
	}
	if req.IconColor == "" {
		req.IconColor = "#00D9A6"
	}

	uid := middleware.UserIDFrom(r.Context())
	g := &repo.Guild{
		ID:        h.IDs.Next(),
		Name:      req.Name,
		IconText:  req.IconText,
		IconColor: req.IconColor,
		OwnerID:   uid,
	}
	if err := h.Guilds.Create(r.Context(), g); err != nil {
		h.logger.Error("guild create", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "sunucu oluşturulamadı")
		return
	}

	// Varsayılan kanal: #genel (text)
	defaultCh := &repo.Channel{
		ID:       h.IDs.Next(),
		GuildID:  &g.ID,
		Type:     "text",
		Name:     "genel",
		Position: 0,
	}
	if err := h.Channels.Create(r.Context(), defaultCh); err != nil {
		h.logger.Warn("default channel create", zap.Error(err))
	}

	writeJSON(w, http.StatusCreated, g)
}

func (h *Handler) ListMyGuilds(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	list, err := h.Guilds.ForUser(r.Context(), uid)
	if err != nil {
		h.logger.Error("list guilds", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "sunucular alınamadı")
		return
	}
	if list == nil {
		list = []repo.Guild{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) GetGuild(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	ok, err := h.Guilds.IsMember(r.Context(), id, uid)
	if err != nil || !ok {
		writeError(w, http.StatusForbidden, "forbidden", "bu sunucunun üyesi değilsin")
		return
	}
	g, err := h.Guilds.ByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "sunucu yok")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "sunucu alınamadı")
		return
	}
	writeJSON(w, http.StatusOK, g)
}

func (h *Handler) ListGuildChannels(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	ok, _ := h.Guilds.IsMember(r.Context(), id, uid)
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
		return
	}
	list, err := h.Channels.ForGuild(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "kanallar alınamadı")
		return
	}
	// ViewChannel izniyle filtrele — kanal override'ları rol bazlı izinleri etkiler
	filtered := make([]repo.Channel, 0, len(list))
	for _, ch := range list {
		p, err := h.computeChannelPerms(r.Context(), id, ch.ID, uid)
		if err != nil {
			continue
		}
		if perms.Has(p, perms.ViewChannel) {
			filtered = append(filtered, ch)
		}
	}
	writeJSON(w, http.StatusOK, filtered)
}

func parseID(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, key), 10, 64)
}
