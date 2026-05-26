package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/perms"
)

type automodRuleReq struct {
	Name             string          `json:"name"`
	Enabled          *bool           `json:"enabled,omitempty"`
	TriggerType      string          `json:"trigger_type"`
	TriggerData      json.RawMessage `json:"trigger_data"`
	Actions          json.RawMessage `json:"actions"`
	ExemptRoleIDs    []string        `json:"exempt_role_ids,omitempty"`
	ExemptChannelIDs []string        `json:"exempt_channel_ids,omitempty"`
}

type automodRuleView struct {
	ID               string          `json:"id"`
	GuildID          string          `json:"guild_id"`
	Name             string          `json:"name"`
	Enabled          bool            `json:"enabled"`
	TriggerType      string          `json:"trigger_type"`
	TriggerData      json.RawMessage `json:"trigger_data"`
	Actions          json.RawMessage `json:"actions"`
	ExemptRoleIDs    []string        `json:"exempt_role_ids"`
	ExemptChannelIDs []string        `json:"exempt_channel_ids"`
	CreatorID        string          `json:"creator_id"`
	CreatedAt        string          `json:"created_at"`
}

func parseInt64Slice(strs []string) []int64 {
	out := make([]int64, 0, len(strs))
	for _, s := range strs {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			out = append(out, v)
		}
	}
	return out
}

func int64ToStringSlice(ids []int64) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, strconv.FormatInt(id, 10))
	}
	return out
}

func validTrigger(t string) bool {
	switch t {
	case "keyword", "regex", "mention_spam", "message_spam", "link_blacklist", "caps", "invite_blacklist":
		return true
	}
	return false
}

func (h *Handler) CreateAutomodRule(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageGuild, w) {
		return
	}
	var req automodRuleReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if req.Name == "" || len(req.Name) > 100 {
		writeError(w, http.StatusBadRequest, "invalid_name", "1-100 karakter")
		return
	}
	if !validTrigger(req.TriggerType) {
		writeError(w, http.StatusBadRequest, "invalid_trigger", "keyword|regex|mention_spam|message_spam|link_blacklist|caps|invite_blacklist")
		return
	}
	if len(req.TriggerData) == 0 {
		req.TriggerData = []byte(`{}`)
	}
	if len(req.Actions) == 0 {
		req.Actions = []byte(`[]`)
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	id := h.IDs.Next()
	exemptRoles := parseInt64Slice(req.ExemptRoleIDs)
	exemptChannels := parseInt64Slice(req.ExemptChannelIDs)

	_, err = h.Pool.Exec(r.Context(), `
        INSERT INTO automod_rules
            (id, guild_id, name, enabled, trigger_type, trigger_data, actions, exempt_role_ids, exempt_channel_ids, creator_id)
        VALUES ($1, $2, $3, $4, $5::automod_trigger_type, $6, $7, $8, $9, $10)
    `, id, guildID, req.Name, enabled, req.TriggerType, []byte(req.TriggerData), []byte(req.Actions), exemptRoles, exemptChannels, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "oluşturulamadı: "+err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":            strconv.FormatInt(id, 10),
		"guild_id":      strconv.FormatInt(guildID, 10),
		"name":          req.Name,
		"enabled":       enabled,
		"trigger_type":  req.TriggerType,
	})
}

func (h *Handler) ListAutomodRules(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageGuild, w) {
		return
	}
	rows, err := h.Pool.Query(r.Context(), `
        SELECT id::text, guild_id::text, name, enabled, trigger_type::text,
               trigger_data, actions, exempt_role_ids, exempt_channel_ids,
               creator_id::text, created_at::text
        FROM automod_rules WHERE guild_id = $1 ORDER BY created_at DESC
    `, guildID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "alınamadı")
		return
	}
	defer rows.Close()
	out := []automodRuleView{}
	for rows.Next() {
		var v automodRuleView
		var trigger, actions []byte
		var exemptRoles, exemptChans []int64
		if err := rows.Scan(&v.ID, &v.GuildID, &v.Name, &v.Enabled, &v.TriggerType,
			&trigger, &actions, &exemptRoles, &exemptChans, &v.CreatorID, &v.CreatedAt); err != nil {
			continue
		}
		v.TriggerData = trigger
		v.Actions = actions
		v.ExemptRoleIDs = int64ToStringSlice(exemptRoles)
		v.ExemptChannelIDs = int64ToStringSlice(exemptChans)
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) DeleteAutomodRule(w http.ResponseWriter, r *http.Request) {
	guildID, err := parseID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id")
		return
	}
	ruleID, err := parseID(r, "ruleID")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "rule id")
		return
	}
	uid := middleware.UserIDFrom(r.Context())
	if !h.requirePerm(r, guildID, uid, perms.ManageGuild, w) {
		return
	}
	if _, err := h.Pool.Exec(r.Context(),
		`DELETE FROM automod_rules WHERE id = $1 AND guild_id = $2`, ruleID, guildID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "silinmedi")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
