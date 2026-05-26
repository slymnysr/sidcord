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

type createRoleReq struct {
	Name        string `json:"name"`
	Color       int32  `json:"color"`
	Permissions string `json:"permissions"`
	Hoist       bool   `json:"hoist"`
	Mentionable bool   `json:"mentionable"`
}

func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if ok, _ := h.Guilds.IsMember(r.Context(), guildID, uid); !ok {
		writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
		return
	}
	list, err := h.Roles.ForGuild(r.Context(), guildID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "roller alınamadı")
		return
	}
	if list == nil {
		list = []repo.Role{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageRoles, w) {
		return
	}

	var req createRoleReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 1 || len(req.Name) > 100 {
		writeError(w, http.StatusBadRequest, "invalid_name", "rol adı 1-100 karakter")
		return
	}

	var permsValue int64
	if req.Permissions != "" {
		v, err := strconv.ParseInt(req.Permissions, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "permissions sayı olmalı")
			return
		}
		permsValue = v
	}

	role := &repo.Role{
		ID:          h.IDs.Next(),
		GuildID:     guildID,
		Name:        req.Name,
		Color:       req.Color,
		Permissions: permsValue,
		Hoist:       req.Hoist,
		Mentionable: req.Mentionable,
	}
	if err := h.Roles.Create(r.Context(), role); err != nil {
		h.logger.Error("role create", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "rol oluşturulamadı")
		return
	}
	h.Events.ToGuild(r.Context(), guildID, "GUILD_ROLE_CREATE", map[string]any{"role": role})
	h.logAudit(r.Context(), guildID, uid, &role.ID, "role_create", "", map[string]string{"name": role.Name})
	writeJSON(w, http.StatusCreated, role)
}

type updateRoleReq struct {
	Name        *string `json:"name,omitempty"`
	Color       *int32  `json:"color,omitempty"`
	Permissions *string `json:"permissions,omitempty"`
	Hoist       *bool   `json:"hoist,omitempty"`
	Mentionable *bool   `json:"mentionable,omitempty"`
	Position    *int32  `json:"position,omitempty"`
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := parseID(r, "roleID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "role id parse")
		return
	}
	role, err := h.Roles.ByID(r.Context(), roleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "rol yok")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, role.GuildID, uid, perms.ManageRoles, w) {
		return
	}

	var req updateRoleReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if req.Name != nil {
		role.Name = *req.Name
	}
	if req.Color != nil {
		role.Color = *req.Color
	}
	if req.Permissions != nil {
		v, err := strconv.ParseInt(*req.Permissions, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "permissions sayı olmalı")
			return
		}
		role.Permissions = v
	}
	if req.Hoist != nil {
		role.Hoist = *req.Hoist
	}
	if req.Mentionable != nil {
		role.Mentionable = *req.Mentionable
	}
	if req.Position != nil {
		role.Position = *req.Position
	}

	if err := h.Roles.Update(r.Context(), role); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "rol güncellenemedi")
		return
	}
	h.Events.ToGuild(r.Context(), role.GuildID, "GUILD_ROLE_UPDATE", map[string]any{"role": role})
	h.logAudit(r.Context(), role.GuildID, uid, &role.ID, "role_update", "", nil)
	writeJSON(w, http.StatusOK, role)
}

func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	roleID, err := parseID(r, "roleID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "role id parse")
		return
	}
	role, err := h.Roles.ByID(r.Context(), roleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "rol yok")
		return
	}
	if role.IsEveryone {
		writeError(w, http.StatusBadRequest, "cannot_delete_everyone", "@everyone silinemez")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, role.GuildID, uid, perms.ManageRoles, w) {
		return
	}
	if err := h.Roles.Delete(r.Context(), roleID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "rol silinemedi")
		return
	}
	h.Events.ToGuild(r.Context(), role.GuildID, "GUILD_ROLE_DELETE", map[string]any{"role_id": roleID})
	h.logAudit(r.Context(), role.GuildID, uid, &roleID, "role_delete", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AssignRole(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "guild id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	roleID, err := strconv.ParseInt(chi.URLParam(r, "roleID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "role id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageRoles, w) {
		return
	}
	if err := h.Roles.AssignToMember(r.Context(), guildID, userID, roleID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "rol atanamadı")
		return
	}
	h.Events.ToGuild(r.Context(), guildID, "GUILD_MEMBER_UPDATE", map[string]any{
		"user_id":      userID,
		"role_added":   roleID,
	})
	h.logAudit(r.Context(), guildID, uid, &userID, "role_assign", "", map[string]any{"role_id": roleID})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) UnassignRole(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "guild id parse")
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "user id parse")
		return
	}
	roleID, err := strconv.ParseInt(chi.URLParam(r, "roleID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "role id parse")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageRoles, w) {
		return
	}
	if err := h.Roles.RemoveFromMember(r.Context(), guildID, userID, roleID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "rol kaldırılamadı")
		return
	}
	h.Events.ToGuild(r.Context(), guildID, "GUILD_MEMBER_UPDATE", map[string]any{
		"user_id":      userID,
		"role_removed": roleID,
	})
	h.logAudit(r.Context(), guildID, uid, &userID, "role_unassign", "", map[string]any{"role_id": roleID})
	w.WriteHeader(http.StatusNoContent)
}

// requirePerm — kullanıcının guildID'de istenen izne sahip olup olmadığını kontrol eder
// false dönerse zaten HTTP yanıtı yazılmıştır
func (h *Handler) requirePerm(r *http.Request, guildID, userID int64, want uint64, w http.ResponseWriter) bool {
	if ok, _ := h.Guilds.IsMember(r.Context(), guildID, userID); !ok {
		writeError(w, http.StatusForbidden, "forbidden", "üye değilsin")
		return false
	}
	have, err := h.Roles.MemberPermissions(r.Context(), guildID, userID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "sunucu yok")
			return false
		}
		writeError(w, http.StatusInternalServerError, "internal", "izin kontrol hatası")
		return false
	}
	if !perms.Has(have, want) {
		writeError(w, http.StatusForbidden, "missing_permission", "yetersiz izin")
		return false
	}
	return true
}
