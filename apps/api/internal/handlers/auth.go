package handlers

import (
	"errors"
	"net"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/sidcord/api/internal/auth"
	"github.com/sidcord/api/internal/middleware"
	"github.com/sidcord/api/internal/repo"
	"go.uber.org/zap"
)

// parseClientIP — X-Forwarded-For veya RemoteAddr'dan IP çıkar
func parseClientIP(r *http.Request) net.IP {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// İlk IP gerçek istemci
		first := strings.TrimSpace(strings.Split(xff, ",")[0])
		if ip := net.ParseIP(first); ip != nil {
			return ip
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(host)
}

var usernameRegex = regexp.MustCompile(`^[a-z0-9_.]{3,32}$`)

type registerReq struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

type authResp struct {
	User         *repo.User `json:"user"`
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	ExpiresAt    time.Time  `json:"expires_at"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !usernameRegex.MatchString(req.Username) {
		writeError(w, http.StatusBadRequest, "invalid_username", "kullanıcı adı 3-32 karakter, sadece a-z 0-9 . _")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_email", "geçerli bir e-posta gir")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "weak_password", "parola en az 8 karakter olmalı")
		return
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		h.logger.Error("hash", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "parola hash hatası")
		return
	}

	user := &repo.User{
		ID:           h.IDs.Next(),
		Username:     req.Username,
		Email:        req.Email,
		DisplayName:  req.DisplayName,
		PasswordHash: hash,
		AvatarColor:  randomBrandColor(),
		Status:       "online",
	}
	if err := h.Users.Create(r.Context(), user); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			writeError(w, http.StatusConflict, "conflict", "kullanıcı adı veya e-posta zaten kullanımda")
			return
		}
		h.logger.Error("user create", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "kullanıcı oluşturulamadı")
		return
	}

	resp, err := h.issueTokens(r, user)
	if err != nil {
		h.logger.Error("issue tokens", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "token üretilemedi")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	clientIP := parseClientIP(r)

	// Brute-force kontrolü: 15 dakikada 5 başarısızdan fazlaysa engelle
	failures, _ := h.LoginAttempts.RecentFailures(r.Context(), req.Email, clientIP, 15*time.Minute)
	if failures >= 5 {
		writeError(w, http.StatusTooManyRequests, "rate_limited",
			"çok fazla başarısız giriş; lütfen 15 dakika sonra tekrar dene")
		return
	}

	user, err := h.Users.ByEmail(r.Context(), req.Email)
	if err != nil {
		// Sabit zaman: aynı yanıt
		_, _ = auth.VerifyPassword(req.Password, "$argon2id$v=19$m=65536,t=2,p=2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
		_ = h.LoginAttempts.Record(r.Context(), h.IDs.Next(), req.Email, clientIP, false)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "e-posta veya parola hatalı")
		return
	}

	ok, err := auth.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !ok {
		_ = h.LoginAttempts.Record(r.Context(), h.IDs.Next(), req.Email, clientIP, false)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "e-posta veya parola hatalı")
		return
	}

	_ = h.LoginAttempts.Record(r.Context(), h.IDs.Next(), req.Email, clientIP, true)

	resp, err := h.issueTokens(r, user)
	if err != nil {
		h.logger.Error("issue tokens", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "internal", "token üretilemedi")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	hash := auth.HashToken(req.RefreshToken)
	tok, err := h.RefreshTokens.ByHash(r.Context(), hash)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_refresh", "refresh token geçersiz")
		return
	}
	user, err := h.Users.ByID(r.Context(), tok.UserID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_refresh", "kullanıcı bulunamadı")
		return
	}
	// Rotasyon: eski token revoke + yeni token üret
	_ = h.RefreshTokens.Revoke(r.Context(), hash)
	resp, err := h.issueTokens(r, user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "token üretilemedi")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFrom(r.Context())
	user, err := h.Users.ByID(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "kullanıcı bulunamadı")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) issueTokens(r *http.Request, user *repo.User) (*authResp, error) {
	access, exp, err := h.Iss.AccessToken(user.ID)
	if err != nil {
		return nil, err
	}
	raw, hash, err := auth.NewRefreshToken()
	if err != nil {
		return nil, err
	}
	ua := r.UserAgent()
	if err := h.RefreshTokens.Create(r.Context(), &repo.RefreshToken{
		ID:        h.IDs.Next(),
		UserID:    user.ID,
		TokenHash: hash,
		UserAgent: &ua,
		ExpiresAt: time.Now().Add(auth.RefreshTTL),
	}); err != nil {
		return nil, err
	}
	return &authResp{
		User:         user,
		AccessToken:  access,
		RefreshToken: raw,
		ExpiresAt:    exp,
	}, nil
}

var brandColors = []string{
	"#00D9A6", "#FF6B6B", "#5865F2", "#EB459E", "#FEE75C",
	"#57F287", "#ED4245", "#9B59B6", "#3498DB", "#1ABC9C",
	"#E67E22", "#F39C12",
}

func randomBrandColor() string {
	return brandColors[time.Now().UnixNano()%int64(len(brandColors))]
}
