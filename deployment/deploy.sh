#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  DukiAI Memory — Production Deploy Script
#  Usage: ./deploy.sh [--init]
#    --init  First-time setup: obtain SSL cert, create DB, run migrations
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $SCRIPT_DIR/docker-compose.prod.yml"

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
[[ -f "$SCRIPT_DIR/.env" ]] || error ".env not found. Copy .env.example → .env and fill in values."
source "$SCRIPT_DIR/.env"

required_vars=(
    DOMAIN
    FRONTEND_ORIGINS
    SECRET_KEY
    POSTGRES_DB
    POSTGRES_USER
    POSTGRES_PASSWORD
    DATABASE_URL
    REDIS_PASSWORD
    REDIS_URL
    MINIO_ROOT_USER
    MINIO_ROOT_PASSWORD
    MINIO_BUCKET_NAME
    OPENAI_API_KEY
)

for var_name in "${required_vars[@]}"; do
    if [[ -z "${!var_name:-}" ]]; then
        error "$var_name is not set in .env"
    fi
done

command -v docker >/dev/null 2>&1 || error "Docker is not installed."
docker compose version >/dev/null 2>&1 || error "Docker Compose plugin v2 is not installed."

INIT_MODE=false
if [[ "${1:-}" == "--init" ]]; then INIT_MODE=true; fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FIRST-TIME INIT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if [[ "$INIT_MODE" == true ]]; then
    info "=== First-time initialisation ==="

    # Start only Nginx on port 80 for ACME challenge (no SSL yet)
    info "Starting Nginx (HTTP only) for ACME challenge..."
    $COMPOSE up -d nginx
    sleep 3

    # Obtain initial cert
    info "Requesting SSL certificate for $DOMAIN..."
    docker run --rm \
        -v "$(docker volume ls -q | grep certbot_conf):/etc/letsencrypt" \
        -v "$(docker volume ls -q | grep certbot_www):/var/www/certbot" \
        certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --email "${EMAIL_FROM:-admin@$DOMAIN}" \
        --agree-tos --no-eff-email \
        || warn "Certbot failed — check DNS and try again. Continuing without SSL..."

    # Swap to full HTTPS config
    info "Reloading Nginx with HTTPS config..."
    $COMPOSE exec nginx nginx -s reload 2>/dev/null || true

    # Start database
    info "Starting PostgreSQL..."
    $COMPOSE up -d postgres
    info "Waiting for Postgres to be healthy..."
    until $COMPOSE exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
        sleep 2
    done

    # Run migrations
    info "Running database migrations..."
    $COMPOSE run --rm api python migrate.py

    # Start MinIO and create bucket
    info "Starting MinIO..."
    $COMPOSE up -d minio
    sleep 5
    docker run --rm --network memoryai_internal \
        minio/mc:latest \
        sh -c "mc alias set local http://minio:9000 '$MINIO_ROOT_USER' '$MINIO_ROOT_PASSWORD' \
               && (mc ls local/$MINIO_BUCKET_NAME 2>/dev/null || mc mb local/$MINIO_BUCKET_NAME) \
               && mc anonymous set download local/$MINIO_BUCKET_NAME/public" \
        || warn "MinIO bucket setup failed — create '$MINIO_BUCKET_NAME' manually in the MinIO console."

    info "Init complete — starting full stack..."
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  REGULAR DEPLOY (also runs after --init)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

info "Pulling latest images..."
$COMPOSE pull --ignore-buildable 2>/dev/null || true

info "Building API image..."
$COMPOSE build --no-cache api

info "Bringing up all services..."
$COMPOSE up -d --remove-orphans

info "Running database migrations..."
$COMPOSE exec -T api python migrate.py || warn "Migration failed — check logs with: docker compose logs api"

info "Reloading Nginx..."
$COMPOSE exec -T nginx nginx -s reload 2>/dev/null || true

info "Verifying health..."
sleep 5
$COMPOSE ps

HEALTH_BODY=$(curl -sf "http://localhost/health" || true)
HEALTH=$(echo "$HEALTH_BODY" | grep -Ec '"status"\s*:\s*"(ok|healthy)"' || true)
if [[ "$HEALTH" -ge 1 ]]; then
    info "✓ API health check passed."
else
    warn "Health check may have failed — response: ${HEALTH_BODY:-<empty>}"
fi

info "=== Deploy complete ==="
info "    API:       https://$DOMAIN"
info "    MinIO UI:  http://<droplet-ip>:9001  (firewall: allow only your IP)"
echo ""
info "Useful commands:"
echo "  $COMPOSE logs -f api        # stream API logs"
echo "  $COMPOSE logs -f nginx      # stream Nginx logs"
echo "  $COMPOSE down               # stop everything"
echo "  $COMPOSE exec api bash      # shell into API container"
