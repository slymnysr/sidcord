package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	PostgresDSN   string
	RedisAddr     string
	RedisPassword string
	JWTSecret     string
	Environment   string
	WorkerID      int64
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		Port:          getEnv("API_PORT", "8080"),
		PostgresDSN:   getEnv("POSTGRES_DSN", "postgres://sidcord:sidcord_dev@localhost:5433/sidcord?sslmode=disable"),
		RedisAddr:     getEnv("REDIS_HOST", "localhost") + ":" + getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		JWTSecret:     getEnv("JWT_SECRET", "dev_secret_change_me"),
		Environment:   getEnv("NODE_ENV", "development"),
		WorkerID:      parseInt64(getEnv("WORKER_ID", "1")),
	}
}

func parseInt64(s string) int64 {
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 1
	}
	return v
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
