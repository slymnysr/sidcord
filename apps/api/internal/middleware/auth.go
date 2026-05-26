package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/sidcord/api/internal/auth"
)

type ctxKey string

const UserIDKey ctxKey = "user_id"

func RequireAuth(iss *auth.Issuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				http.Error(w, `{"error":"unauthorized","detail":"bearer token gerekli"}`, http.StatusUnauthorized)
				return
			}
			token := strings.TrimPrefix(h, "Bearer ")
			claims, err := iss.Verify(token)
			if err != nil {
				http.Error(w, `{"error":"unauthorized","detail":"token geçersiz"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserIDFrom(ctx context.Context) int64 {
	v, _ := ctx.Value(UserIDKey).(int64)
	return v
}
