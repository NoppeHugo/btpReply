# MANIP.md — Étapes manuelles à faire

> Ce fichier liste tout ce qui ne peut pas être automatisé par le code.
> Cocher chaque étape au fur et à mesure.

---

## 1. Docker Desktop

- [ ] Installer Docker Desktop : https://docs.docker.com/desktop/install/windows-install/
- [ ] Lancer Docker Desktop et attendre que la baleine soit verte dans la barre des tâches
- [ ] Lancer Postgres en local :
  ```bash
  docker compose -f docker-compose.dev.yml up -d
  ```
- [ ] Appliquer la première migration (crée toutes les tables) :
  ```bash
  pnpm db:migrate
  ```
  *(donner un nom quand Prisma demande, ex: `init`)*
- [ ] Insérer les données de test :
  ```bash
  pnpm db:seed
  ```
- [ ] Vérifier que l'app tourne :
  ```bash
  pnpm dev
  ```
  Ouvrir http://localhost:3000/api/v1/health → doit retourner `{"ok":true}`

---

## 2. Twilio

- [ ] Créer un compte Twilio : https://www.twilio.com/try-twilio
- [ ] Acheter un numéro belge `+32` (Console → Phone Numbers → Buy a number → Belgium)
- [ ] Récupérer les clés dans Console → Account → API keys & tokens :
  - `TWILIO_ACCOUNT_SID` (commence par `AC…`)
  - `TWILIO_AUTH_TOKEN`
- [ ] ⚠️ `TWILIO_WEBHOOK_SIGNING_KEY` = **la même valeur que `TWILIO_AUTH_TOKEN`**.
  La validation `X-Twilio-Signature` utilise l'Auth Token du compte — il n'existe
  PAS de « clé de signature webhook » séparée dans la console. Toute autre valeur
  → tous les webhooks rejetés en 403 et aucun SMS n'est envoyé.
- [ ] Configurer les webhooks sur le numéro (Console → Phone Numbers → Manage → ton numéro) :
  - **Voice Configuration** → A call comes in : `https://ton-domaine.com/api/v1/webhooks/twilio/voice` (HTTP POST)
  - **Messaging Configuration** → A message comes in : `https://ton-domaine.com/api/v1/webhooks/twilio/sms` (HTTP POST)
- [ ] ⚠️ `APP_BASE_URL` doit correspondre **exactement** au domaine des webhooks
  (https, sans slash final, sans www) : la signature est calculée sur l'URL complète.
- [ ] Après déploiement : tester un appel réel de bout en bout (appel manqué → SMS reçu)
  avant de brancher un client
- [ ] Activer les garde-fous anti-fraude du compte Twilio :
  - Messaging Geo Permissions : limiter aux pays BE / FR / NL
  - Alertes de dépense (Console → Billing → Triggers)
- [ ] Ajouter ces valeurs dans le fichier `.env` local
- [ ] Configurer le renvoi conditionnel sur le téléphone du client artisan :
  - **Sur iPhone (Belgique)** : Paramètres → Téléphone → Renvoi d'appel conditionnel → activer "Si pas de réponse" → entrer le numéro Twilio `+32…`
  - **Sur Android** : Téléphone → ⋮ → Paramètres → Comptes SIM → Renvoi d'appel → Si pas de réponse → numéro Twilio
  - **Via opérateur (pro)** : taper `**61*+32XXXXXXXX#` sur le clavier (USSD code universel)

---

## 3. GitHub Actions — Secrets pour le déploiement VPS

*(À faire quand le VPS Hetzner est commandé)*

- [ ] Aller sur GitHub → ton repo → Settings → Secrets and variables → Actions
- [ ] Ajouter les secrets suivants :
  | Secret | Valeur |
  |---|---|
  | `VPS_HOST` | IP du serveur Hetzner (ex: `65.21.x.x`) |
  | `VPS_USER` | Utilisateur SSH (ex: `root` ou `deploy`) |
  | `VPS_SSH_KEY` | Contenu de ta clé privée SSH (`cat ~/.ssh/id_rsa`) |
  | `POSTGRES_PASSWORD` | Mot de passe Postgres en prod (générer un mot de passe fort) |

---

## 4. VPS Hetzner — Setup initial

*(À faire une seule fois, avant le premier déploiement)*

- [ ] Commander un VPS Hetzner CX22 (EU, Nuremberg ou Helsinki) : https://www.hetzner.com/cloud
- [ ] Se connecter en SSH et installer Docker + Docker Compose :
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- [ ] Cloner le repo sur le VPS :
  ```bash
  git clone https://github.com/NoppeHugo/btpReply.git /opt/btpreply
  ```
- [ ] Créer le fichier `.env` sur le VPS (`/opt/btpreply/.env`) en copiant `.env.example` et en remplissant toutes les valeurs
- [ ] Premier déploiement manuel :
  ```bash
  cd /opt/btpreply
  docker compose run --rm migrate
  docker compose up -d
  ```

---

## 4bis. Backups Postgres (obligatoire avant le 1er client)

> Sans backup externalisé, un disque VPS perdu = toutes les données clients perdues.

- [ ] Rendre le script exécutable et le tester une fois à la main :
  ```bash
  chmod +x /opt/btpreply/scripts/backup-db.sh
  /opt/btpreply/scripts/backup-db.sh
  ```
- [ ] Installer le cron quotidien (2h du matin) :
  ```bash
  (crontab -l 2>/dev/null; echo "0 2 * * * /opt/btpreply/scripts/backup-db.sh >> /var/log/btpreply-backup.log 2>&1") | crontab -
  ```
- [ ] Externaliser `/opt/backups/btpreply` vers un stockage hors VPS
  (Hetzner Storage Box ~4 €/mois : `rclone sync` ou `rsync` après le dump)
- [ ] Tester une restauration une fois :
  ```bash
  gunzip -c backup.sql.gz | docker compose exec -T db psql -U btpreply -d btpreply_restore_test
  ```

---

## 5. Resend (emails)

*(À faire avant la Phase 4 — alertes & récap quotidien)*

- [ ] Créer un compte Resend : https://resend.com
- [ ] Vérifier ton domaine email (DNS TXT)
- [ ] Créer une API key → copier dans `RESEND_API_KEY` (`.env` local + secret GitHub + `.env` VPS)
