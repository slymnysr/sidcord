# Sidcord

Türkiye için yerli Discord alternatifi. Tam özellik paritesi hedefli.

## Mimari Özet

| Bileşen | Teknoloji | Klasör |
|---------|-----------|--------|
| Gateway (WebSocket) | Elixir/Phoenix | `apps/gateway` |
| API (REST) | Go + chi | `apps/api` |
| Voice/Video SFU | Node.js + mediasoup | `apps/voice` (Faz 2) |
| Web istemcisi | React + Vite + Redux Toolkit + Tailwind | `apps/web` |
| Desktop | Electron | `apps/desktop` (Faz 4) |
| Mobile | React Native | `apps/mobile` (Faz 4) |
| Mesaj DB | ScyllaDB | docker compose |
| Ana DB | PostgreSQL | docker compose |
| Cache | Redis | docker compose |
| Object storage | MinIO (dev) → Cloudflare R2 (prod) | docker compose |

## Faz 0: Geliştirme Ortamı Kurulumu

### 1. Gerekli runtime'lar

```bash
# pnpm (Node 20+ kuruluysa)
npm install -g pnpm@9

# Elixir (Ubuntu/WSL)
sudo apt-get update
sudo apt-get install -y elixir erlang-dev erlang-xmerl erlang-os-mon

# Go 1.22
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Docker zaten kurulu olmalı (WSL üzerinden Docker Desktop)
```

### 2. Veritabanlarını başlat

```bash
cp .env.example .env
pnpm db:up
```

PostgreSQL (5432), Redis (6379), ScyllaDB (9042), MinIO (9000) ayağa kalkar.

MinIO konsoluna `http://localhost:9001` üzerinden erişebilirsin (sidcord/sidcord_dev_minio).

### 3. Bağımlılıkları yükle

```bash
# Kökten (workspace bağımlılıkları için)
pnpm install

# Gateway için ayrıca
cd apps/gateway && mix deps.get && cd ../..

# API için ayrıca
cd apps/api && go mod download && cd ../..
```

### 4. Servisleri çalıştır

3 ayrı terminalde:

```bash
# Terminal 1 — Gateway
cd apps/gateway && mix phx.server
# Port 4000

# Terminal 2 — API
cd apps/api && make run
# Port 8080

# Terminal 3 — Web
cd apps/web && pnpm dev
# Port 3000
```

Tarayıcıdan `http://localhost:3000` adresine git.

### 5. Sağlık kontrolü

```bash
curl http://localhost:4000/health  # Gateway
curl http://localhost:8080/health  # API
```

## Faz Yol Haritası

- **Faz 0** (şimdi) — İskele ✓
- **Faz 1** — MVP chat (auth, sunucu/kanal/rol, text, DM, dosya)
- **Faz 2** — Voice (mediasoup SFU)
- **Faz 3** — Video + ekran paylaşımı
- **Faz 4** — Desktop (Electron) + Mobile (React Native)
- **Faz 5** — Moderasyon + KVKK uyum
- **Faz 6** — Bot API + premium
- **Faz 7** — Polish (stage, forum, soundboard, vs.)

## Lisans

Henüz seçilmedi. Faz 1 öncesinde karar verilecek.
