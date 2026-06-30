#!/usr/bin/env bash
# =============================================================================
# btpReply — Déploiement sur VPS CCM (Caddy Docker existant sur ccm_internal)
# =============================================================================
# Usage : sudo bash /opt/btpreply/scripts/deploy-vps-ccm.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[AVERT]${NC} $*"; }
step()    { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }
ask()     { echo -e "${YELLOW}  → $1${NC}"; read -r -p "    Valeur : " _val; echo "$_val"; }

APP_DIR="/opt/btpreply"
CADDYFILE="/home/hugo/ccm/Caddyfile"
APP_DOMAIN="app.btpreply.be"
CADDY_CONTAINER="ccm-caddy-1"
CCM_NETWORK="ccm_internal"

[[ $EUID -ne 0 ]] && error "Relancer en root : sudo bash $0"
[[ ! -d "$APP_DIR/.git" ]] && error "Repo absent. Cloner d'abord : git clone ... $APP_DIR"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  btpReply — Deploy sur VPS CCM                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Fichier .env ───────────────────────────────────────────────────────────
step "Configuration .env"

ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"
fi

# Générer les secrets si non définis
_set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=$" "$ENV_FILE" || grep -q "^${key}=changeme$" "$ENV_FILE" || ! grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*||" "$ENV_FILE"
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

_get_env() { grep "^${1}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' || echo ""; }

# Secrets auto-générés
POSTGRES_PW=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
_set_env "POSTGRES_PASSWORD"  "$POSTGRES_PW"
_set_env "DATABASE_URL"       "postgresql://btpreply:${POSTGRES_PW}@db:5432/btpreply"
_set_env "AUTH_SECRET"        "$(openssl rand -base64 32)"
_set_env "API_SECRET_KEY"     "$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
_set_env "APP_BASE_URL"       "https://${APP_DOMAIN}"
_set_env "APP_DOMAIN"         "${APP_DOMAIN}"
_set_env "ANTHROPIC_MODEL_QUALIFICATION" "claude-haiku-4-5"
_set_env "INITIAL_SMS_DELAY_MS" "30000"
_set_env "FROM_EMAIL"         "btpReply <noreply@btpreply.be>"

success "Secrets auto-générés (POSTGRES_PASSWORD, AUTH_SECRET, API_SECRET_KEY)"

# Demander les clés manquantes
echo ""
warn "Renseigner les clés API externes (laisser vide pour passer et éditer .env plus tard)"
echo ""

_ask_key() {
  local key="$1" label="$2" current
  current=$(_get_env "$key")
  if [[ -z "$current" || "$current" == "sk-ant-"* ]] && [[ "$current" != sk-ant-api* ]]; then
    echo -ne "${YELLOW}  $label${NC} : "
    read -r val
    if [[ -n "$val" ]]; then
      sed -i "s|^${key}=.*||" "$ENV_FILE"
      echo "${key}=${val}" >> "$ENV_FILE"
    fi
  else
    success "$key déjà défini"
  fi
}

_ask_key "ANTHROPIC_API_KEY"         "Anthropic API key (sk-ant-...)"
_ask_key "TWILIO_ACCOUNT_SID"        "Twilio Account SID (AC...)"
_ask_key "TWILIO_AUTH_TOKEN"         "Twilio Auth Token"
_ask_key "TWILIO_WEBHOOK_SIGNING_KEY" "Twilio Webhook Signing Key"
_ask_key "RESEND_API_KEY"            "Resend API key (re_...)"
_ask_key "STRIPE_SECRET_KEY"         "Stripe Secret Key (sk_live_ ou sk_test_...)"
_ask_key "STRIPE_WEBHOOK_SECRET"     "Stripe Webhook Secret (whsec_...)"
_ask_key "STRIPE_PRICE_BASE"         "Stripe Price ID — plan Base (price_...)"
_ask_key "STRIPE_PRICE_PLUS"         "Stripe Price ID — plan Plus (price_...)"
_ask_key "SENTRY_DSN"                "Sentry DSN (https://...@sentry.io/...)"
_ask_key "NEXT_PUBLIC_SENTRY_DSN"    "Sentry DSN public (même valeur)"
_ask_key "SEED_ADMIN_PASSWORD"       "Mot de passe admin initial"

# Nettoyer les lignes vides laissées par sed
sed -i '/^$/d' "$ENV_FILE"
chown hugo:hugo "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE"

success ".env prêt"

# ── 2. docker-compose.override.yml ───────────────────────────────────────────
step "Docker Compose override (réseau ccm_internal, pas de Caddy)"

cat > "$APP_DIR/docker-compose.override.yml" <<EOF
# Généré automatiquement par deploy-vps-ccm.sh
# - Désactive Caddy (géré par ccm-caddy-1)
# - Branche l'app sur le réseau ccm_internal pour que Caddy puisse la joindre
services:
  app:
    networks:
      - default
      - ccm_internal
  caddy:
    profiles: ["disabled"]

networks:
  ccm_internal:
    external: true
EOF

chown hugo:hugo "$APP_DIR/docker-compose.override.yml"
success "docker-compose.override.yml créé"

# ── 3. Caddyfile — ajout de app.btpreply.be ───────────────────────────────────
step "Caddyfile"

if grep -q "app.btpreply.be" "$CADDYFILE"; then
  success "app.btpreply.be déjà dans le Caddyfile"
else
  cat >> "$CADDYFILE" <<'EOF'

app.btpreply.be {
  tls admin@btpreply.be
  reverse_proxy btpreply-app-1:3000
}
EOF
  success "app.btpreply.be ajouté au Caddyfile"
fi

# ── 4. Build ──────────────────────────────────────────────────────────────────
step "Build des images Docker"
cd "$APP_DIR"
docker compose build app worker migrate
success "Build terminé"

# ── 5. Migrations ─────────────────────────────────────────────────────────────
step "Migrations Prisma"
docker compose run --rm migrate
success "Migrations OK"

# ── 6. Seed admin ─────────────────────────────────────────────────────────────
step "Seed admin"
SEED_PW=$(_get_env "SEED_ADMIN_PASSWORD")
if [[ -n "$SEED_PW" && "$SEED_PW" != "changeme" ]]; then
  docker compose run --rm \
    -e SEED_ADMIN_PASSWORD="$SEED_PW" \
    migrate pnpm exec tsx prisma/seed.ts 2>&1 || \
  docker compose run --rm \
    -e SEED_ADMIN_PASSWORD="$SEED_PW" \
    migrate node -r tsconfig-paths/register -r ts-node/register prisma/seed.ts 2>&1 || \
  warn "Seed ignoré — lancer manuellement si besoin"
  success "Seed admin créé"
else
  warn "SEED_ADMIN_PASSWORD vide ou 'changeme' — seed ignoré (définir dans .env et relancer)"
fi

# ── 7. Démarrage ──────────────────────────────────────────────────────────────
step "Démarrage app + worker"
docker compose up -d app worker
success "Containers démarrés"

# ── 8. Recharger Caddy ────────────────────────────────────────────────────────
step "Rechargement Caddy"
sleep 5  # laisser l'app démarrer
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
success "Caddy rechargé"

# ── 9. Vérification ───────────────────────────────────────────────────────────
step "Vérification"
sleep 8  # attendre Next.js ready

HEALTH=$(docker exec btpreply-app-1 wget -qO- http://localhost:3000/api/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  success "Health check OK : $HEALTH"
elif echo "$HEALTH" | grep -q '"status"'; then
  warn "App répond mais état dégradé : $HEALTH"
else
  warn "App pas encore prête — vérifier avec : docker compose logs app"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Déploiement terminé !                                ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Dashboard  : https://${APP_DOMAIN}                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Health     : https://${APP_DOMAIN}/api/health     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Logs app   : docker compose -f $APP_DIR/docker-compose.yml logs -f app ${GREEN}║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Webhooks à configurer dans Twilio :               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   Voice: https://${APP_DOMAIN}/api/v1/webhooks/twilio/voice ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   SMS  : https://${APP_DOMAIN}/api/v1/webhooks/twilio/sms   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Webhook Stripe :                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   https://${APP_DOMAIN}/api/webhooks/stripe        ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
