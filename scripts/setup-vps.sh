#!/usr/bin/env bash
# =============================================================================
# btpReply — Setup VPS partagé (Ubuntu 22/24 LTS)
# =============================================================================
# Usage  : sudo bash setup-vps.sh [--domain app.btpreply.be]
#
# Ce script est NON-DESTRUCTIF :
#  ✔  détecte Docker, Nginx, Apache, Caddy déjà installés
#  ✔  n'écrase pas le pare-feu existant, n'efface pas les autres sites
#  ✔  expose l'app sur le port 3001 (interne), NE prend PAS le port 80/443
#  ✔  génère un snippet Nginx/Caddy à inclure dans ta config existante
#  ✔  garde tout dans /opt/btpreply (isolé)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[AVERT]${NC} $*"; }
step()    { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

# ── Paramètres ────────────────────────────────────────────────────────────────
APP_DIR="/opt/btpreply"
DEPLOY_USER="deploy"
GITHUB_REPO="https://github.com/VOTRE_ORG/btpReply.git"  # ← à remplacer
APP_PORT=3001            # port interne (ne touche pas aux autres sites)
APP_DOMAIN="app.btpreply.be"

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) APP_DOMAIN="$2"; shift 2 ;;
    --repo)   GITHUB_REPO="$2"; shift 2 ;;
    --port)   APP_PORT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ $EUID -ne 0 ]] && error "Relancer en root : sudo bash $0"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  btpReply — Setup VPS (mode partagé)  ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo "  Domaine    : $APP_DOMAIN"
echo "  Port interne: $APP_PORT"
echo "  Répertoire : $APP_DIR"
echo ""

# ── Détection de l'environnement existant ────────────────────────────────────
step "Détection de l'environnement"

PROXY_TYPE="none"
PORT80_PID=$(lsof -ti:80 2>/dev/null | head -1 || true)
PORT443_PID=$(lsof -ti:443 2>/dev/null | head -1 || true)

if systemctl is-active nginx &>/dev/null; then
  PROXY_TYPE="nginx"
  success "Nginx détecté et actif — btpReply sera ajouté comme site Nginx"
elif systemctl is-active apache2 &>/dev/null; then
  PROXY_TYPE="apache"
  warn "Apache détecté — un VirtualHost sera créé"
elif systemctl is-active caddy &>/dev/null; then
  PROXY_TYPE="caddy"
  success "Caddy (système) détecté — un snippet Caddyfile sera créé"
elif [[ -n "$PORT80_PID" ]]; then
  PROXY_TYPE="unknown"
  warn "Quelque chose écoute sur le port 80 (PID $PORT80_PID) — mode manuel"
else
  PROXY_TYPE="none"
  warn "Aucun reverse proxy détecté — le Caddy Docker sera utilisé"
fi

DOCKER_EXISTS=false
if command -v docker &>/dev/null; then
  DOCKER_EXISTS=true
  success "Docker déjà installé ($(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1))"
fi

# ── 1. Paquets de base ────────────────────────────────────────────────────────
step "Paquets système"
apt-get update -qq
apt-get install -y -qq curl git unattended-upgrades apt-transport-https ca-certificates gnupg lsof
success "Paquets de base OK"

# ── 2. Docker Engine (si absent) ─────────────────────────────────────────────
step "Docker"
if ! $DOCKER_EXISTS; then
  info "Installation de Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  success "Docker installé"
fi

# Rotation logs Docker (non-destructif : ajoute seulement si absent)
DAEMON_JSON="/etc/docker/daemon.json"
if [ ! -f "$DAEMON_JSON" ]; then
  mkdir -p /etc/docker
  cat > "$DAEMON_JSON" <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
EOF
  systemctl restart docker
  success "Rotation logs Docker configurée"
elif ! grep -q "max-size" "$DAEMON_JSON" 2>/dev/null; then
  warn "daemon.json existant — vérifier la rotation des logs manuellement"
fi

# ── 3. Pare-feu (non-destructif) ─────────────────────────────────────────────
step "Pare-feu"
if command -v ufw &>/dev/null; then
  ufw allow "$APP_PORT/tcp" comment "btpReply interne" 2>/dev/null || true
  if [[ "$PROXY_TYPE" == "none" ]]; then
    ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
  fi
  ufw reload 2>/dev/null || true
  success "Règles UFW ajoutées (existantes conservées)"
else
  warn "UFW non trouvé — s'assurer que le port $APP_PORT est accessible depuis localhost"
fi

# ── 4. Utilisateur deploy ─────────────────────────────────────────────────────
step "Utilisateur deploy"
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd --create-home --shell /bin/bash --groups docker "$DEPLOY_USER"
  success "Utilisateur '$DEPLOY_USER' créé"
else
  usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
  success "Utilisateur '$DEPLOY_USER' existant, groupe docker vérifié"
fi

DEPLOY_SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$DEPLOY_SSH_DIR"
touch "$DEPLOY_SSH_DIR/authorized_keys"
chmod 700 "$DEPLOY_SSH_DIR"
chmod 600 "$DEPLOY_SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_SSH_DIR"

# ── 5. Clone / mise à jour du repo ───────────────────────────────────────────
step "Repository"
if [ ! -d "$APP_DIR/.git" ]; then
  if [[ "$GITHUB_REPO" == *"VOTRE_ORG"* ]]; then
    warn "GITHUB_REPO non configuré — cloner manuellement dans $APP_DIR"
    mkdir -p "$APP_DIR"
  else
    git clone "$GITHUB_REPO" "$APP_DIR"
    success "Repo cloné dans $APP_DIR"
  fi
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
else
  cd "$APP_DIR"
  sudo -u "$DEPLOY_USER" git pull origin main
  success "Repo à jour"
fi

# ── 6. Fichier .env ───────────────────────────────────────────────────────────
step "Variables d'environnement"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ] && [ -f "$APP_DIR/.env.example" ]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"

  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
  AUTH_SECRET=$(openssl rand -base64 32)
  API_SECRET=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)

  sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://btpreply:${POSTGRES_PASSWORD}@db:5432/btpreply|" "$ENV_FILE"
  # Ajouter les variables manquantes dans .env
  grep -q "^POSTGRES_PASSWORD=" "$ENV_FILE" || echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> "$ENV_FILE"
  grep -q "^APP_DOMAIN="        "$ENV_FILE" || echo "APP_DOMAIN=${APP_DOMAIN}" >> "$ENV_FILE"
  sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|"           "$ENV_FILE"
  sed -i "s|API_SECRET_KEY=.*|API_SECRET_KEY=${API_SECRET}|"      "$ENV_FILE"
  sed -i "s|APP_BASE_URL=.*|APP_BASE_URL=https://${APP_DOMAIN}|"  "$ENV_FILE"

  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  success ".env généré avec secrets aléatoires"
elif [ ! -f "$ENV_FILE" ]; then
  warn ".env.example introuvable — créer $ENV_FILE manuellement"
else
  success ".env déjà présent"
fi

# ── 7. docker-compose.override.yml (port interne sans Caddy) ─────────────────
step "Docker Compose override"
OVERRIDE_FILE="$APP_DIR/docker-compose.override.yml"

if [[ "$PROXY_TYPE" != "none" ]]; then
  # Pas de Caddy — on expose l'app sur APP_PORT en local seulement
  cat > "$OVERRIDE_FILE" <<EOF
# Auto-généré par setup-vps.sh
# Désactive Caddy (géré par $PROXY_TYPE sur ce VPS) et expose app:$APP_PORT
services:
  app:
    ports:
      - "127.0.0.1:${APP_PORT}:3000"
  caddy:
    profiles: ["disabled"]
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$OVERRIDE_FILE"
  success "Override: app sur 127.0.0.1:$APP_PORT, Caddy désactivé"
else
  # Caddy Docker gère tout
  cat > "$OVERRIDE_FILE" <<EOF
# Auto-généré par setup-vps.sh
# Caddy Docker gère TLS et expose 80/443
services:
  app:
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$OVERRIDE_FILE"
  success "Override: Caddy Docker sur 80/443"
fi

# ── 8. Config reverse proxy ───────────────────────────────────────────────────
step "Configuration reverse proxy ($PROXY_TYPE)"

SNIPPETS_DIR="$APP_DIR/scripts/proxy-snippets"
mkdir -p "$SNIPPETS_DIR"

# Nginx
cat > "$SNIPPETS_DIR/nginx-btpreply.conf" <<EOF
# ── btpReply — à inclure dans /etc/nginx/sites-available/ ──
# ln -s $SNIPPETS_DIR/nginx-btpreply.conf /etc/nginx/sites-enabled/btpreply
# nginx -t && systemctl reload nginx

server {
    listen 80;
    server_name ${APP_DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${APP_DOMAIN};

    # TLS — adapter selon ton setup (certbot, acme.sh, etc.)
    ssl_certificate     /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
EOF

# Caddy snippet
cat > "$SNIPPETS_DIR/caddy-btpreply.conf" <<EOF
# ── btpReply — à importer dans ton Caddyfile existant ──
# import $SNIPPETS_DIR/caddy-btpreply.conf

${APP_DOMAIN} {
    reverse_proxy 127.0.0.1:${APP_PORT}
}
EOF

# Apache
cat > "$SNIPPETS_DIR/apache-btpreply.conf" <<EOF
# ── btpReply — VirtualHost Apache ──
# a2enmod proxy proxy_http headers rewrite ssl
# ln -s $SNIPPETS_DIR/apache-btpreply.conf /etc/apache2/sites-available/btpreply.conf
# a2ensite btpreply && apachectl graceful

<VirtualHost *:443>
    ServerName ${APP_DOMAIN}

    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

    Header always set X-Forwarded-Proto "https"
</VirtualHost>
<VirtualHost *:80>
    ServerName ${APP_DOMAIN}
    Redirect permanent / https://${APP_DOMAIN}/
</VirtualHost>
EOF

success "Snippets proxy générés dans $SNIPPETS_DIR/"
echo ""
echo "  → nginx-btpreply.conf"
echo "  → caddy-btpreply.conf"
echo "  → apache-btpreply.conf"

if [[ "$PROXY_TYPE" == "nginx" ]]; then
  echo ""
  warn "Nginx détecté. Pour activer btpReply :"
  echo "  # (1) Obtenir le certificat TLS"
  echo "  certbot certonly --nginx -d ${APP_DOMAIN}"
  echo "  # (2) Activer le site"
  echo "  ln -s $SNIPPETS_DIR/nginx-btpreply.conf /etc/nginx/sites-enabled/btpreply"
  echo "  nginx -t && systemctl reload nginx"
elif [[ "$PROXY_TYPE" == "caddy" ]]; then
  echo ""
  warn "Caddy (système) détecté. Ajouter dans /etc/caddy/Caddyfile :"
  echo "  import $SNIPPETS_DIR/caddy-btpreply.conf"
  echo "  systemctl reload caddy"
elif [[ "$PROXY_TYPE" == "apache" ]]; then
  echo ""
  warn "Apache détecté. Pour activer btpReply :"
  echo "  certbot certonly --apache -d ${APP_DOMAIN}"
  echo "  ln -s $SNIPPETS_DIR/apache-btpreply.conf /etc/apache2/sites-available/btpreply.conf"
  echo "  a2ensite btpreply && apachectl graceful"
fi

# ── 9. Mises à jour de sécurité auto ─────────────────────────────────────────
step "Sécurité auto"
if [ ! -f /etc/apt/apt.conf.d/50unattended-upgrades ] || \
   ! grep -q "security" /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null; then
  cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  success "Mises à jour de sécurité automatiques activées"
else
  success "unattended-upgrades déjà configuré"
fi

# ── 10. Commandes de déploiement ──────────────────────────────────────────────
step "Prochaines étapes"

echo ""
echo -e "${CYAN}── Étape A : Compléter .env ──────────────────────────────────${NC}"
echo "  nano $ENV_FILE"
echo ""
echo "  Variables requises (non auto-générées) :"
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo "    SMSTOOLS_CLIENT_ID=..."
echo "    SMSTOOLS_CLIENT_SECRET=..."
echo "    SMSTOOLS_SENDER=+324..."
echo "    SMSTOOLS_WEBHOOK_SECRET=<token secret webhook entrant>"
echo "    TWILIO_WEBHOOK_SIGNING_KEY=...   # voix"
echo "    RESEND_API_KEY=re_..."
echo "    STRIPE_SECRET_KEY=sk_live_..."
echo "    STRIPE_WEBHOOK_SECRET=whsec_..."
echo "    STRIPE_PRICE_BASE=price_..."
echo "    STRIPE_PRICE_PLUS=price_..."
echo "    SENTRY_DSN=https://...@sentry.io/..."
echo "    NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/..."
echo "    SEED_ADMIN_PASSWORD=<mot de passe fort>"
echo ""
echo -e "${CYAN}── Étape B : Premier déploiement ─────────────────────────────${NC}"
echo "  cd $APP_DIR"
echo "  docker compose build app worker migrate"
echo "  docker compose run --rm migrate                    # migrations DB"
echo "  docker compose run --rm migrate pnpm exec ts-node prisma/seed.ts  # seed admin"
echo "  docker compose up -d app worker"
if [[ "$PROXY_TYPE" == "none" ]]; then
  echo "  docker compose up -d caddy"
fi
echo ""
echo -e "${CYAN}── Étape C : Vérification ────────────────────────────────────${NC}"
echo "  curl http://localhost:$APP_PORT/api/health    # → {\"status\":\"ok\"}"
echo "  docker compose ps                              # tous en Running"
echo ""
echo -e "${CYAN}── Étape D : GitHub Actions (CI/CD) ──────────────────────────${NC}"
echo "  Secrets à ajouter dans GitHub → Settings → Secrets :"
echo "    VPS_HOST     = $(curl -s https://api.ipify.org 2>/dev/null || echo '<IP_DU_VPS>')"
echo "    VPS_USER     = $DEPLOY_USER"
echo "    VPS_SSH_KEY  = <clé privée SSH du user deploy>"
echo ""
echo "  Clé publique à ajouter côté VPS :"
echo "    /home/$DEPLOY_USER/.ssh/authorized_keys"
echo ""

# ── Checklist finale ──────────────────────────────────────────────────────────
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  CHECKLIST GO-LIVE                                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  ☐ .env complété (API keys, Stripe, Sentry, Twilio)    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ DNS A : ${APP_DOMAIN} → $(curl -s https://api.ipify.org 2>/dev/null || echo '<IP>')        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ TLS certificat obtenu (certbot ou Caddy auto)       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Reverse proxy configuré (snippet $PROXY_TYPE)        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ docker compose up -d (app + worker)                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ /api/health → {\"status\":\"ok\"}                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Twilio webhook voix :                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}      Voice: https://${APP_DOMAIN}/api/v1/webhooks/twilio/voice${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ smstools webhook SMS entrant (inbox_message) :      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}      https://${APP_DOMAIN}/api/v1/webhooks/smstools/inbound?token=... ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Stripe webhook : https://${APP_DOMAIN}/api/webhooks/stripe${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Clé SSH GitHub Actions dans authorized_keys         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Secrets GitHub (VPS_HOST/USER/SSH_KEY)              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ 1er client pilote via /dashboard/clients/new        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ☐ Test appel manqué de bout en bout                   ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
success "Script terminé. Voir les étapes A→D ci-dessus."
