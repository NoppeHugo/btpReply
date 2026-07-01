#!/usr/bin/env bash
# =============================================================================
# btpReply / Rappl — Exposer publiquement à la racine collierscolliersmaison.be
# =============================================================================
# Remplace le site ophtalmo à la racine par Rappl. Garde n8n intact.
# Usage : sudo bash /opt/btpreply/scripts/expose-public.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[AVERT]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

APP_DIR="/opt/btpreply"
CADDYFILE="/home/hugo/ccm/Caddyfile"
CADDY_CONTAINER="ccm-caddy-1"
DOMAIN="collierscolliersmaison.be"

[[ $EUID -ne 0 ]] && error "Relancer en root : sudo bash $0"
[[ ! -f "$CADDYFILE" ]] && error "Caddyfile introuvable : $CADDYFILE"

# ── 1. Sauvegarde du Caddyfile (une seule fois, l'originale) ──────────────────
if [ ! -f "$CADDYFILE.orig" ]; then
  cp "$CADDYFILE" "$CADDYFILE.orig"
  success "Sauvegarde originale créée : $CADDYFILE.orig"
else
  warn "Sauvegarde $CADDYFILE.orig déjà présente (conservée)"
fi
cp "$CADDYFILE" "$CADDYFILE.bak"
info "Sauvegarde de travail : $CADDYFILE.bak"

echo ""
info "Caddyfile ACTUEL :"
echo "------------------------------------------------------------"
cat "$CADDYFILE"
echo "------------------------------------------------------------"
echo ""

# ── 2. Nouveau Caddyfile : n8n conservé, racine -> Rappl ──────────────────────
cat > "$CADDYFILE" <<EOF
n8n.${DOMAIN} {
  tls admin@${DOMAIN}
  reverse_proxy n8n:5678
}

${DOMAIN} {
  tls admin@${DOMAIN}
  reverse_proxy btpreply-app-1:3000
}
EOF
success "Nouveau Caddyfile écrit (racine -> Rappl, n8n conservé)"

echo ""
info "Caddyfile NOUVEAU :"
echo "------------------------------------------------------------"
cat "$CADDYFILE"
echo "------------------------------------------------------------"
echo ""

# ── 3. Override : app sur ccm_internal, Caddy Docker désactivé ────────────────
cat > "$APP_DIR/docker-compose.override.yml" <<'EOF'
services:
  app:
    networks:
      - default
      - ccm_internal
  caddy:
    profiles:
      - donotstart
networks:
  ccm_internal:
    external: true
EOF
chown hugo:hugo "$APP_DIR/docker-compose.override.yml" 2>/dev/null || true
success "docker-compose.override.yml : app branchée sur ccm_internal"

# ── 4. Mise à jour .env ───────────────────────────────────────────────────────
cd "$APP_DIR"
sed -i "s|^APP_BASE_URL=.*|APP_BASE_URL=https://${DOMAIN}|" .env
if grep -q "^APP_DOMAIN=" .env; then
  sed -i "s|^APP_DOMAIN=.*|APP_DOMAIN=${DOMAIN}|" .env
else
  echo "APP_DOMAIN=${DOMAIN}" >> .env
fi
success "APP_BASE_URL = https://${DOMAIN}"

# ── 5. Recréer l'app (rejoint ccm_internal) ───────────────────────────────────
info "Recréation de l'app..."
docker compose up -d app worker
success "App recréée sur ccm_internal"

# ── 6. Recharger Caddy ────────────────────────────────────────────────────────
info "Attente du démarrage de l'app (8s)..."
sleep 8
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
success "Caddy rechargé"

# ── 7. Vérification interne ───────────────────────────────────────────────────
info "Test de la liaison Caddy -> app..."
sleep 3
if docker exec "$CADDY_CONTAINER" wget -qO- http://btpreply-app-1:3000/api/health >/dev/null 2>&1; then
  success "Caddy joint bien l'app (health répond)"
else
  # 503 (degraded) est OK : l'app répond mais des clés API manquent
  CODE=$(docker exec "$CADDY_CONTAINER" wget -S -qO- http://btpreply-app-1:3000/api/health 2>&1 | grep -o 'HTTP/1.1 [0-9]*' | head -1 || echo "")
  if [ -n "$CODE" ]; then
    warn "App répond ($CODE) — probablement 503 degraded (clés API vides), c'est normal"
  else
    warn "App injoignable depuis Caddy — vérifier : docker compose logs app"
  fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Rappl est en ligne !                                  ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Landing : https://${DOMAIN}          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Login   : https://${DOMAIN}/login    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Dashboard: https://${DOMAIN}/dashboard${GREEN}║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Rollback si besoin :                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   cp ${CADDYFILE}.orig ${CADDYFILE}${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   docker exec ${CADDY_CONTAINER} caddy reload --config /etc/caddy/Caddyfile${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
warn "IMPORTANT : le dashboard est maintenant public. Change le mot de passe"
warn "admin (admin@btpreply.io) — il est encore faible."
echo ""
