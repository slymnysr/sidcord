package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/sidcord/api/internal/auth"
	"github.com/sidcord/api/internal/handlers"
	mw "github.com/sidcord/api/internal/middleware"
)

func New(h *handlers.Handler, iss *auth.Issuer) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://*.sidcord.com"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", h.Health)
	r.Get("/version", h.Version)

	r.Route("/api/v1", func(r chi.Router) {
		// Anonim
		r.Post("/auth/register", h.Register)
		r.Post("/auth/login", h.Login)
		r.Post("/auth/refresh", h.Refresh)

		// Auth gerekli
		r.Group(func(r chi.Router) {
			r.Use(mw.RequireAuth(iss))

			r.Get("/users/me", h.Me)
			r.Patch("/users/me/status", h.UpdateMyStatus)

			r.Post("/guilds", h.CreateGuild)
			r.Get("/guilds", h.ListMyGuilds)
			r.Get("/guilds/{id}", h.GetGuild)
			r.Get("/guilds/{id}/channels", h.ListGuildChannels)
			r.Get("/guilds/{id}/members", h.ListGuildMembers)
			r.Post("/guilds/{id}/invites", h.CreateInvite)
			r.Get("/guilds/{id}/invites", h.ListGuildInvites)
			r.Get("/guilds/{id}/roles", h.ListRoles)
			r.Post("/guilds/{id}/roles", h.CreateRole)
			r.Patch("/guilds/{id}/roles/{roleID}", h.UpdateRole)
			r.Delete("/guilds/{id}/roles/{roleID}", h.DeleteRole)
			r.Put("/guilds/{id}/members/{userID}/roles/{roleID}", h.AssignRole)
			r.Delete("/guilds/{id}/members/{userID}/roles/{roleID}", h.UnassignRole)

			r.Get("/invites/{code}", h.GetInvite)
			r.Post("/invites/{code}/accept", h.AcceptInvite)
			r.Delete("/invites/{code}", h.DeleteInvite)

			r.Post("/channels", h.CreateChannel)
			r.Get("/channels/{channelID}/messages", h.ListMessages)
			r.Post("/channels/{channelID}/messages", h.CreateMessage)
			r.Patch("/messages/{messageID}", h.EditMessage)
			r.Delete("/messages/{messageID}", h.DeleteMessage)
			r.Get("/channels/{channelID}/overrides", h.ListChannelOverrides)
			r.Put("/channels/{channelID}/overrides", h.UpsertChannelOverride)
			r.Delete("/channels/{channelID}/overrides/{targetType}/{targetID}", h.DeleteChannelOverride)

			r.Get("/users/me/channels", h.ListMyDMs)
			r.Post("/users/me/channels", h.OpenDM)

			r.Delete("/guilds/{id}/members/{userID}", h.KickMember)
			r.Patch("/guilds/{id}/members/{userID}/timeout", h.TimeoutMember)
			r.Get("/guilds/{id}/bans", h.ListBans)
			r.Put("/guilds/{id}/bans/{userID}", h.BanMember)
			r.Delete("/guilds/{id}/bans/{userID}", h.Unban)

			r.Get("/messages/{messageID}/reactions", h.ListReactions)
			r.Put("/messages/{messageID}/reactions/{emoji}", h.AddReaction)
			r.Delete("/messages/{messageID}/reactions/{emoji}", h.RemoveReaction)

			r.Post("/uploads/presign", h.PresignUpload)

			r.Get("/notifications", h.ListNotifications)
			r.Get("/notifications/count", h.NotificationsCount)
			r.Post("/notifications/read-all", h.MarkAllNotificationsRead)

			r.Get("/friends", h.ListFriends)
			r.Post("/friends", h.SendFriendRequest)
			r.Put("/friends/{userID}/accept", h.AcceptFriend)
			r.Delete("/friends/{userID}", h.RemoveFriend)

			r.Get("/search/messages", h.SearchMessages)

			r.Get("/channels/{channelID}/pins", h.ListPins)
			r.Put("/messages/{messageID}/pin", h.PinMessage)
			r.Delete("/messages/{messageID}/pin", h.UnpinMessage)

			// P0 yeni endpoint'ler
			r.Patch("/users/me", h.UpdateMe)
			r.Patch("/guilds/{id}", h.UpdateGuild)
			r.Delete("/guilds/{id}", h.DeleteGuild)
			r.Post("/guilds/{id}/leave", h.LeaveGuild)
			r.Patch("/channels/{channelID}", h.UpdateChannel)
			r.Delete("/channels/{channelID}", h.DeleteChannel)
			r.Get("/guilds/{id}/audit-log", h.ListAuditLogs)

			// P1: Threads
			r.Post("/channels/{channelID}/threads", h.CreateThread)
			r.Get("/channels/{channelID}/threads", h.ListThreads)
			r.Put("/channels/{channelID}/thread-members/me", h.JoinThread)
			r.Delete("/channels/{channelID}/thread-members/me", h.LeaveThread)
			r.Patch("/channels/{channelID}/thread-state", h.UpdateThreadState)

			// P1: Custom emojis
			r.Get("/guilds/{id}/emojis", h.ListEmojis)
			r.Post("/guilds/{id}/emojis", h.CreateEmoji)
			r.Delete("/guilds/{id}/emojis/{emojiID}", h.DeleteEmoji)

			// P1: Webhooks
			r.Get("/channels/{channelID}/webhooks", h.ListWebhooks)
			r.Post("/channels/{channelID}/webhooks", h.CreateWebhook)
			r.Delete("/webhooks/{webhookID}", h.DeleteWebhook)

			// P1: Read state
			r.Get("/users/me/read-states", h.ListReadStates)
			r.Post("/channels/{channelID}/ack", h.AckChannel)

			// P1: Notification settings
			r.Get("/users/me/settings", h.GetMySettings)
			r.Put("/guilds/{id}/notif-settings", h.UpdateGuildNotifSettings)
			r.Put("/channels/{channelID}/notif-settings", h.UpdateChannelNotifSettings)

			// P1: Group DM
			r.Post("/users/me/group-channels", h.CreateGroupDM)
			r.Put("/channels/{channelID}/recipients/{userID}", h.AddGroupDMRecipient)
			r.Delete("/channels/{channelID}/recipients/{userID}", h.RemoveGroupDMRecipient)
		})

		// Webhook execute — anonim (token URL içinde doğrulanır)
		r.Post("/webhooks/{webhookID}/{token}", h.ExecuteWebhook)
	})

	return r
}
