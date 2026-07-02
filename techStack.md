# techStack.md — Choix techniques (source de vérité)

> Ce fichier est **la référence unique** pour tous les choix techniques du projet.
> Un agent ne choisit JAMAIS une techno, une lib ou un service qui n'est pas listé ici.
> Tout ajout ou changement de dépendance doit d'abord être inscrit dans ce fichier
> (section concernée + entrée dans le « Journal des décisions » en bas), puis seulement implémenté.

---

## 0. Le produit en une ligne

Service qui fait qu'une PME ne perd plus jamais un client à cause d'un appel manqué :
appel manqué → SMS automatique au client → qualification par conversation → alerte au patron → récap quotidien.
Multi-tenant (un client = un « tenant ») dès la conception.

**Règle de vocabulaire produit (stricte) :** côté client final, le service se comporte comme un secrétariat.
Les mots « IA », « bot », « robot », « automatique » sont **interdits** dans tout texte envoyé à un appelant.

---

## 1. Langage & runtime

| Élément | Choix | Version cible | Pourquoi |
|---|---|---|---|
| Langage | **TypeScript** | 5.x, `strict: true` | Un seul langage du back au front ; le typage fort contraint les agents et réduit les bugs. |
| Runtime | **Node.js** | 22 LTS | LTS stable, large support des SDK (Twilio, Anthropic, Resend). |
| Package manager | **pnpm** | 9.x | Rapide, lockfile déterministe. |

**Interdits :** `any` non justifié, code JavaScript pur (`.js`) dans `src/`, dépendances non listées ici.

---

## 2. Application & framework

| Élément | Choix | Pourquoi | Alternative écartée |
|---|---|---|---|
| Framework | **Next.js (App Router)** | Dashboard + route handlers (webhooks) dans un seul déploiement. | Backend séparé (NestJS) : trop lourd pour le MVP. |
| Process longs | **Worker Node séparé** (`/worker`) | Webhooks et jobs planifiés nécessitent un process long-vivant. | Serverless (Vercel functions) : timeouts + cold starts mauvais pour la téléphonie, et data hors-UE. |
| UI | **Tailwind CSS + shadcn/ui** | Rapide, propre, connu des agents. | Librairies UI lourdes (MUI). |

Le **worker** et l'**app** partagent le même code (monorepo simple, pas de packages multiples) mais ont deux points d'entrée distincts.

---

## 3. Base de données

| Élément | Choix | Pourquoi |
|---|---|---|
| SGBD | **PostgreSQL 16** | Le choix ennuyeux et correct ; transactionnel, multi-tenant facile. |
| Hébergement | **VPS Heltzner ou OVH** en MVP ; Postgres self-hosted sur le VPS en option | Managé + RGPD ; **la région DOIT être en UE**. |
| ORM | **Prisma** | `schema.prisma` = contrat unique qui contraint fortement les agents ; types générés. |

**Multi-tenant (règle dure) :** chaque table métier porte une colonne `clientId`. **Toute** requête doit être scopée par `clientId`. Aucune requête cross-tenant n'est autorisée hors du module d'admin interne.

### Modèle de données (cœur — détaillé dans `schema.prisma`)

- `Client` — le tenant (la PME). Config, plan, statut. Champs `displayName` (renommage côté admin) et `stage` (prospect / actif / en pause) pour la gestion client.
- `User` — accès dashboard (rôle : `admin` interne, `owner` côté client).
- `PhoneNumber` — numéro Twilio rattaché à un `Client` (clé de routage des webhooks entrants).
- `Call` — chaque appel manqué capté (numéro appelant, horodatage, statut).
- `Conversation` — fil SMS lié à un `Call` / appelant, état (`open`, `qualified`, `handed_off`, `closed`).
- `Message` — chaque SMS entrant/sortant (direction, contenu, horodatage).
- `Lead` — résultat qualifié (type, urgence, localisation, dispo, résumé, statut de rappel).
- `WhitelistEntry` — numéros exclus (fournisseurs, perso).
- `BusinessHours` — plages horaires par client (messages différents jour/hors-heures).
- `MessageTemplate` — gabarits de messages personnalisés par client.
- `ClientNote` — notes / récap des échanges entre vous (les fondateurs) et un `Client` (CRM interne).
- `ClientMessage` — messages sortants envoyés par vous à un `Client` (artisan) ; canal `sms`/`email`/`in_app`, contenu, statut, auteur.

---

## 4. Téléphonie & SMS

| Élément | Choix | Notes |
|---|---|---|
| Fournisseur | **Twilio** | Programmable Voice (renvoi conditionnel / appels manqués) + Programmable Messaging (SMS). |
| Numéros | **Numéros locaux belges (+32)** | Confiance + conformité ; un numéro par client. |
| Captation appel | **Renvoi d'appel conditionnel** côté client → numéro Twilio | On ne touche jamais au numéro principal du client ; seuls les appels NON décrochés arrivent. |
| Alternative EU notée | **Bird (ex-MessageBird)** | Acteur EU, à réévaluer si la résidence des données SMS devient un point bloquant. Ne PAS migrer sans décision écrite. |

**Règles SMS :**
- Premier message : nom de la boîte explicite + mention d'opt-out **« STOP »** (obligatoire BE/FR).
- Viser ≤ 2 segments (~320 caractères).
- Vérifier la **signature des webhooks Twilio** (header `X-Twilio-Signature`) sur chaque endpoint entrant.
- FR par défaut, détection NL automatique (zone frontalière).

---

## 5. LLM (qualification)

| Élément | Choix | Notes |
|---|---|---|
| Fournisseur | **Anthropic — Claude API** | |
| Modèle qualification | **`claude-haiku-4-5`** (pinné : `claude-haiku-4-5-20251001`) | Rapide + bon marché ($1/$5 par M tokens) ; suffisant pour extraction/qualif. |
| Modèle résumé (si besoin) | `claude-sonnet-4-6` | Uniquement si la qualité du résumé l'exige. À justifier. |
| Format | **Sortie structurée / tool use** (JSON strict) | Jamais de parsing au regex de texte libre. |
| Optimisation | **Prompt caching** sur le system prompt | Réduit le coût d'entrée ~10×. |

**Contrat de sortie du LLM (fixe)** — l'agent ne change pas ce schéma sans décision écrite :
```json
{
  "reply": "string — le SMS à renvoyer au client (ton humain, jamais 'IA')",
  "qualification": {
    "type": "string|null",
    "urgency": "low|medium|high|null",
    "location": "string|null",
    "availability": "string|null",
    "summary": "string"
  },
  "complete": true,
  "needs_human": false
}
```

**Règles LLM (dures) :**
- Ce qui peut être fait par une règle déterministe (horaires, liste blanche, STOP) ne passe **pas** par le LLM.
- Plafond de tours de conversation = **6**. Au-delà → `needs_human = true` et handoff.
- Aucune donnée client n'est utilisée pour de l'entraînement ; appels API standard uniquement.
- **Optimisation des coûts : voir `AICOSTS.md`** (prompt caching, sortie minimale, batch pour l'offline, mesure du coût/lead).

---

## 6. Email

| Élément | Choix | Notes |
|---|---|---|
| Transactionnel | **Resend** | Excellente DX, connu des agents (récap quotidien + alertes). |
| Alternative EU | **Brevo** (FR/EU) | À privilégier si résidence des données email exigée. Décision écrite avant migration. |

Le **récap quotidien** est un livrable produit central (rétention) : il doit inclure le compteur « X appels captés, Y leads ce mois ».

---

## 7. Jobs planifiés / asynchrone

| Besoin | Choix MVP | Choix à l'échelle |
|---|---|---|
| Relances (J+3) & récap quotidien | **Cron simple dans le worker** qui interroge Postgres (tâches dues / statuts) | **BullMQ + Redis** quand le volume l'exige. |

Ne PAS introduire Redis/BullMQ tant que le cron simple suffit. Pas de sur-ingénierie.

---

## 8. Auth & dashboard

| Élément | Choix |
|---|---|
| Auth | **Auth.js** si Postgres self-hosted |
| Accès MVP | Admin interne (vous) + vue propriétaire en lecture pour le client |

---

## 8.5 API-first (compatibilité app mobile)

La plateforme est **API-first** : le dashboard web ET la future app mobile consomment la **même API**.

- **Style :** REST/JSON versionné sous `/api/v1/...` (préféré à tRPC, car une app native iOS/Android consomme mal du tRPC).
- **Logique métier dans `/lib`**, jamais dans l'UI ni couplée à Next : l'UI n'est qu'un client de l'API.
- **Auth app-ready :** jetons (bearer) que le web et le mobile peuvent obtenir (pas uniquement des cookies de session web).
- **DTO typés + validation (zod)** en entrée/sortie ; documentation OpenAPI générée.
- **Aucun état serveur spécifique au web** : tout passe par l'API documentée.

> Conséquence : toute fonctionnalité de « gestion client » (récap par client, renommage, envoi de message) est exposée via `/api/v1` dès sa création.

---

## 8.6 Facturation

| Élément | Choix | Notes |
|---|---|---|
| Paiements | **Stripe** | Subscriptions mensuelles, Billing Portal, webhooks signés. |
| Plans | `base` (inclus) · `plus` (numéro supplémentaire +39 €/mois) | Price IDs configurés dans `.env` (`STRIPE_PRICE_BASE`, `STRIPE_PRICE_PLUS`). |
| Données billing | `stripeCustomerId String?` + `plan String` sur `Client` | Pas de modèle séparé en MVP. |

---

## 9. Infra & déploiement

| Élément | Choix | Pourquoi |
|---|---|---|
| Hébergement | **VPS Hetzner (région EU)** | Coût (~5-15 €/mois), process longs, résidence des données UE. |
| Conteneurisation | **Docker + Docker Compose** | `app` + `worker` (+ Postgres si self-hosted). |
| Reverse proxy / TLS | **Caddy** | TLS automatique, config minimale. |
| CI/CD | **GitHub + GitHub Actions** | Lint + test + build + déploiement. |
| Alternative facile notée | Railway / Render (région EU) | Plus cher ; acceptable si la gestion VPS bloque. |

---

## 10. Qualité, observabilité, sécurité

| Élément | Choix |
|---|---|
| Tests | **Vitest** (unitaire) ; Playwright plus tard (e2e). |
| Logs | **pino** (structuré JSON). **Jamais** logger le contenu d'un SMS en clair en prod (PII). |
| Erreurs | **Sentry** (région EU). |
| Analytics produit | **PostHog** (optionnel, EU). |
| Secrets | **Variables d'environnement uniquement.** Jamais de secret en dur, jamais commité. |

### Variables d'environnement (noms canoniques)
```
DATABASE_URL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_QUALIFICATION=claude-haiku-4-5
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WEBHOOK_SIGNING_KEY=
RESEND_API_KEY=
APP_BASE_URL=
SENTRY_DSN=
```

---

## 11. RGPD / conformité (contrainte transverse, non négociable)

On stocke des **données personnelles** (numéros, contenu de conversations). Donc :
- Hébergement et services en **région UE** par défaut.
- **Minimisation** : ne stocker que le nécessaire.
- **Rétention** : politique de purge des conversations (ex. 12 mois) à implémenter.
- **Opt-out STOP** fonctionnel et respecté immédiatement.
- Registre de traitement + base légale (intérêt légitime / contrat) à documenter côté business.

---

## Journal des décisions (ADR léger)

Chaque décision technique structurante est consignée ici, datée. Format : `AAAA-MM-JJ — décision — raison`.

- **2026-06-29 — Stack 100 % code (TypeScript) plutôt que n8n.** Raison : build piloté par agents IA (le code se versionne/teste mieux que des workflows visuels) + produit multi-tenant maintenable.
- **2026-06-29 — Twilio retenu vs Bird.** Raison : meilleure doc et familiarité des agents ; Bird gardé en alternative EU.
- **2026-06-29 — Haiku 4.5 pour la qualification.** Raison : coût/latence ; Sonnet réservé aux cas justifiés.
- **2026-06-29 — VPS Hetzner EU + Docker.** Raison : coût, process longs, résidence des données UE.
- **2026-06-29 — Architecture API-first (REST `/api/v1`, auth par jeton).** Raison : le dashboard web et la future app mobile consomment la même API ; logique dans `/lib`.
- **2026-06-30 — Prisma 7 : driver adapter obligatoire (`@prisma/adapter-pg` + `pg`).** Raison : Prisma 7 a supprimé la connexion directe par URL dans PrismaClient ; singleton dans `src/lib/db.ts`.
- **2026-06-30 — Auth API v1 P0 par token statique (`API_SECRET_KEY`), remplacé par JWT en P6-T1.** Raison : pas de sur-ingénierie en P0 ; le contrat bearer est posé dès maintenant pour la compatibilité mobile.
- **2026-06-30 — Postgres self-hosted sur VPS Hetzner plutôt que Supabase.** Raison : choix utilisateur ; réduit les coûts et garde toutes les données sur le VPS. Docker Compose gère Postgres en local (dev) et en prod.
- **2026-06-30 — Stripe retenu pour la facturation (P7-T3).** Raison : standard, connu des agents, excellent support des subscriptions et Billing Portal. Intégration minimale MVP : customer + subscription + webhook + portal.
- **2026-07-02 — SMS initial via table `ScheduledJob` traitée par le worker (audit F1).** Raison : le `setTimeout` en mémoire perdait les SMS planifiés à chaque redéploiement/crash. Le webhook persiste un job, le worker le traite toutes les 10 s (claim atomique, retries plafonnés). Pas de Redis : Postgres suffit (règle §7).
- **2026-07-02 — Transparence IA (AI Act art. 50, applicable août 2026, audit J3).** Le bot ne prétend plus être une personne physique ; si l'appelant demande explicitement s'il parle à un robot, il le confirme (« service de messages automatisé ») et passe en `needs_human`. Exception assumée à la règle de vocabulaire §0 — décision légale, ne pas revert sans avis juridique.
- **2026-07-02 — Opt-out élargi (audit S3).** STOP et variantes FR/NL (« stop. », « arrêt », « uitschrijven »…) détectées par normalisation + premier mot (`src/lib/sms/optout.ts`) ; START/UNSTOP gèrent la réinscription. Idempotence des webhooks Twilio (CallSid/MessageSid rejoués → 200 sans doublon).
- **2026-07-02 — Site : contact unifié `contact@rappl.be`, pages légales (`/mentions-legales`, `/confidentialite`, `/cgv`, `/p`), formulaire de démo (`DemoRequest` + `POST /api/v1/demo-requests`).** Le CTA `mailto:` vers rappl.eu est remplacé.
