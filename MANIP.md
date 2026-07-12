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
- [ ] Créer une clé de signature webhook (Console → Phone Numbers → Manage → ton numéro → Voice Configuration) :
  - Webhook URL : `https://ton-domaine.com/api/v1/webhooks/twilio/voice`
  - Méthode : `HTTP POST`
  - Copier la valeur dans `TWILIO_WEBHOOK_SIGNING_KEY`
- [ ] Ajouter ces valeurs dans le fichier `.env` local
- [ ] Configurer le renvoi conditionnel sur le téléphone du client artisan :
  - **Sur iPhone (Belgique)** : Paramètres → Téléphone → Renvoi d'appel conditionnel → activer "Si pas de réponse" → entrer le numéro Twilio `+32…`
  - **Sur Android** : Téléphone → ⋮ → Paramètres → Comptes SIM → Renvoi d'appel → Si pas de réponse → numéro Twilio
  - **Via opérateur (pro)** : taper `**004*+32XXXXXXXX#` sur le clavier (USSD universel — active les renvois « pas de réponse », « occupé » et « injoignable » d'un coup ; `##004#` pour tout désactiver)

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

## 5. Resend (emails)

*(À faire avant la Phase 4 — alertes & récap quotidien)*

- [ ] Créer un compte Resend : https://resend.com
- [ ] Vérifier ton domaine email (DNS TXT)
- [ ] Créer une API key → copier dans `RESEND_API_KEY` (`.env` local + secret GitHub + `.env` VPS)
