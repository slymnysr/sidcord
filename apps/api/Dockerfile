FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /api ./cmd/api

FROM alpine:3.19
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 sidcord
COPY --from=builder /api /api
USER sidcord
EXPOSE 8080
ENTRYPOINT ["/api"]
