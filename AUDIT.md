# AUDIT.md — Audit complet de l'application Rappl (btpReply)

> Audit réalisé le 2026-07-02 sur la branche `main` (commit `8a54a4f`).
> Portée : code source, sécurité, fiabilité, déploiement, conformité (RGPD / AI Act / télécom),
> et volet business. Les priorités sont notées **P0** (bloquant avant mise en production),
> **P1** (à faire dans les semaines qui suivent), **P2** (amélioration).

---

## 1. Résumé exécutif

L'application est **bien conçue pour un MVP** : TypeScript strict, tests unitaires (34 verts),
signatures Twilio et Stripe vérifiées, isolation multi-tenant disciplinée, coûts LLM maîtrisés
(prompt caching, 1 segment SMS forcé), purge RGPD automatique. La CI est verte sur `main`.

Mais elle **n'est pas prête pour un client payant** en l'état. Quatre problèmes P0 :

1. **Le déploiement automatique n'a jamais fonctionné** — le workflow `Deploy` échoue à chaque
   push (`error: missing server host`) car les secrets GitHub `VPS_HOST` / `VPS_USER` /
   `VPS_SSH_KEY` ne sont pas configurés.
2. **Le SMS initial (cœur du produit) peut être perdu silencieusement** — il repose sur un
   `setTimeout` en mémoire dans le process Next.js.
3. **Aucune sauvegarde de la base de données** — la perte du VPS = perte de toutes les données clients.
4. **Le pipeline LLM tourne en synchrone dans le webhook Twilio** — risque de timeout,
   de retries en boucle et d'erreurs 500 en cascade.

S'y ajoute un **risque réglementaire sérieux** : la consigne produit « ne jamais dire que c'est
un programme » entre en conflit frontal avec l'obligation de transparence de l'AI Act européen
(article 50), applicable à partir du **2 août 2026** — dans un mois.

---

## 2. Points forts (à conserver)

- **Architecture claire** : app Next.js + worker séparé pour les crons, monorepo simple, `techStack.md` comme source de vérité.
- **Sécurité webhooks** : signature `X-Twilio-Signature` vérifiée sur voice ET sms ; signature Stripe vérifiée ; rejet 403 propre.
- **Multi-tenant discipliné** : toutes les requêtes métier vues sont scopées `clientId` ; les routes API vérifient `conversation.clientId !== user.clientId`.
- **Maîtrise des coûts** : Haiku par défaut, prompt caching (system + tool), `max_tokens: 300`, troncature à 1 segment SMS (`enforceSingleSegment`), sortie structurée via tool use forcé.
- **RGPD, bonnes bases** : purge automatique à 12 mois (cron mensuel), opt-out STOP avec confirmation, mention STOP dans chaque gabarit, hébergement UE (Hetzner), Sentry région EU.
- **Qualité** : TS strict, 34 tests unitaires verts en CI, Zod sur les entrées API, logs structurés pino.

---

## 3. Constats P0 — bloquants avant le premier client payant

### P0-1 · Le déploiement échoue à chaque push depuis la création du workflow

**Constat.** Tous les runs du workflow `Deploy` sont en échec. Log du dernier run :
`2026/07/02 15:23:21 error: missing server host`. Les secrets `VPS_HOST`, `VPS_USER`,
`VPS_SSH_KEY` n'existent pas dans les paramètres du dépôt GitHub. Le code sur le VPS (rappl.be)
n'est donc jamais mis à jour automatiquement.

**Solution.**
- Créer les 3 secrets dans GitHub → Settings → Secrets and variables → Actions.
- Ajouter la dépendance CI → Deploy pour ne jamais déployer du code cassé :

```yaml
# .github/workflows/deploy.yml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
```

### P0-2 · SMS initial planifié par `setTimeout` en mémoire — perte silencieuse

**Constat.** `src/lib/calls/service.ts` → `scheduleInitialSms()` utilise `setTimeout(…, 30 000)`.
Si le process Next.js redémarre pendant la fenêtre (déploiement — `docker compose up -d` recrée
le conteneur —, crash, OOM), le SMS n'est **jamais envoyé** et rien ne le signale. C'est
exactement le moment où le produit doit être fiable : chaque SMS perdu = un chantier perdu pour
le client = churn.

**Solution.** Persister l'intention d'envoi en base et laisser le worker l'exécuter :
1. Ajouter un champ sur `Call` (`initialSmsStatus: pending|sent|skipped`, `initialSmsDueAt DateTime`).
2. Le webhook voice se contente de créer le `Call` avec `dueAt = now + delay`.
3. Le worker exécute un cron toutes les 10 s (`node-cron` accepte les secondes) qui traite les
   `Call` où `dueAt <= now AND status = pending`, avec `UPDATE … WHERE status='pending'` en
   garde d'idempotence.
4. Bonus : un `Call` jamais traité devient visible (monitoring) au lieu de disparaître.

### P0-3 · Aucune sauvegarde PostgreSQL

**Constat.** Postgres vit dans un volume Docker sur un seul VPS. Aucun `pg_dump`, aucune copie
hors-site. Un incident disque / une erreur `docker volume rm` / une compromission = perte
définitive de tous les appels, conversations, leads et comptes.

**Solution (simple et suffisante au début).**
- Cron quotidien sur le VPS : `pg_dump -Fc` → chiffrement (age/gpg) → upload vers un stockage
  objet UE (Hetzner Storage Box ou S3 Scaleway), rétention 30 jours.
- Tester la **restauration** une fois (une sauvegarde non testée n'existe pas).
- L'ajouter dans `MANIP.md` comme étape obligatoire avant le 1er client.

### P0-4 · Pipeline LLM synchrone dans le webhook SMS + retries Twilio destructeurs

**Constat.** `webhooks/twilio/sms/route.ts` fait, dans la requête HTTP : écriture DB → appel
Claude → envoi SMS → écritures DB. Twilio timeout à ~15 s : un appel LLM lent → Twilio
considère l'échec → **retry avec le même `MessageSid`** → `recordMessage` viole la contrainte
unique `twilioSid` → exception non gérée → 500 → nouveau retry. Résultat possible : réponses
en double ou erreurs en cascade, hors de tout contrôle.

**Solution.**
1. **Idempotence explicite en tête de route** : si `MessageSid` déjà en base → répondre 200
   immédiatement.
2. **Répondre 200 tout de suite** et traiter la qualification hors requête. Au choix :
   `after()` de Next 15+ (simple), ou une table `Job` traitée par le worker (robuste, cohérent
   avec P0-2). Éviter d'introduire Redis/BullMQ à ce stade — hors techStack.

---

## 4. Constats P1 — sécurité et robustesse

### P1-1 · `API_SECRET_KEY` : un seul jeton statique = admin global sur tous les tenants

- `src/lib/api/auth.ts` : `token === secret` (comparaison non constant-time) donne
  `role: admin, clientId: "*"` sur **toute** l'API v1.
- Le `.env.example` livre `API_SECRET_KEY=change-me-before-prod` : si oublié, l'API est ouverte
  avec un secret connu publiquement (le dépôt suffit).
- **Solutions** : (a) refuser au démarrage les valeurs par défaut (`validateEnv` doit rejeter
  `change-me-before-prod` et `changeme`) ; (b) `crypto.timingSafeEqual` ; (c) à terme, des
  jetons par client (table `ApiToken` hashée) scoper au tenant — indispensable pour l'app mobile
  prévue en P8, sinon l'app mobile embarquerait un jeton admin global.

### P1-2 · Aucune protection brute-force sur /login

Credentials + bcrypt, mais pas de rate limiting, pas de verrouillage de compte, pas de 2FA,
pas de reset de mot de passe. Un dashboard qui expose les numéros de téléphone et les demandes
de particuliers est une cible RGPD.
**Solution MVP** : rate-limit en mémoire par IP+email sur l'action de login (5 essais / 15 min),
délai progressif, et procédure de reset (même manuelle au début : l'admin régénère).
Le seed crée `admin@btpreply.io` avec le mot de passe `changeme` si `SEED_ADMIN_PASSWORD` est
absent — même remède : refuser la valeur par défaut hors dev.

### P1-3 · Opt-out STOP trop strict et par tenant

- Seul le mot exact `STOP` (trim + upper) est reconnu. « STOP SVP », « stop merci », « ARRET »,
  « ARRÊT » ne déclenchent pas l'opt-out → l'appelant continue à recevoir des SMS après avoir
  exprimé son refus. Risque : plainte télécom/RGPD.
- L'opt-out est stocké par `clientId` : la personne qui envoie STOP à un artisan reste
  contactable par tous les autres tenants.
- **Solutions** : reconnaître STOP en début/mot isolé + variantes FR/NL (`ARRET`, `ARRÊT`,
  `UITSCHRIJVEN`…) ; activer aussi l'Advanced Opt-Out Twilio (filet au niveau opérateur) ;
  documenter le choix per-tenant (défendable, chaque artisan est responsable de traitement
  distinct — mais l'écrire noir sur blanc dans le registre des traitements).

### P1-4 · Stripe : événements traités partiellement

- `invoice.payment_failed` est seulement loggé : aucun email, aucune relance, aucun passage en
  `paused`. Un client qui ne paie plus continue à consommer SMS + LLM indéfiniment.
- Price ID inconnu → fallback silencieux sur `plan: "base"`.
- **Solutions** : sur `payment_failed`, notifier l'admin (vous) + après N échecs passer
  `stage: paused` (Stripe Smart Retries fait les relances) ; logger en `error` un price ID
  inconnu au lieu de deviner.

### P1-5 · Pas de rate limiting sur les webhooks et l'API

La signature Twilio protège l'authenticité, pas le volume (un client Twilio compromis ou un
rejeu = coûts LLM/SMS). **Solution simple** : compteur en mémoire par numéro appelant
(ex. max 10 SMS entrants / heure / numéro → basculer la conversation en `handed_off`).
Le garde-fou « 6 tours » existe déjà, c'est bien ; il manque le garde-fou volumétrique.

### P1-6 · Durcissement HTTP absent

`Caddyfile` = 2 lignes, aucun header de sécurité. **Solution** :

```caddyfile
{$APP_DOMAIN} {
  reverse_proxy app:3000
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

(Une CSP est souhaitable mais à tester avec Next/inline styles — P2.)

### P1-7 · Divers robustesse

- `requireAuth()` (`src/lib/api/auth.ts`) ne fait pas ce que son nom promet (il ne renvoie pas
  401, c'est un alias de `getAuthedUser`) — piège pour le prochain développeur : le supprimer
  ou l'implémenter vraiment.
- Pas de healthcheck Docker sur `app` et `worker` (`/api/health` existe déjà, autant s'en
  servir) ; pas de monitoring uptime externe (UptimeRobot ou équivalent, gratuit).
- Le worker exécute les crons sans retry ni signalement d'échec au-delà du log : brancher
  Sentry `captureException` (Sentry est déjà initialisé) et une alerte email à vous-mêmes si le
  récap quotidien échoue.

---

## 5. Conformité — le point le plus urgent n'est pas technique

### 5-1 · AI Act (UE) — transparence obligatoire au 2 août 2026 ⚠️

Le system prompt impose : « Vous représentez de vraies personnes du bureau, jamais un programme »
et `techStack.md` interdit les mots « IA », « bot », « automatique » côté appelant. Or l'article
50 de l'AI Act impose d'informer une personne physique qu'elle interagit avec un système d'IA
(sauf si c'est évident du contexte). **Cette obligation s'applique à partir du 2 août 2026** —
avant votre premier client si le pilote démarre cet été. Se faire passer activement pour des
humains est précisément le cas visé.

**Solution qui préserve le produit.** La proposition de valeur (« le client se sent pris en
charge ») ne nécessite pas de mentir :
- Premier SMS : « Bonjour, ici l'assistant de \{entreprise\}. Nous avons manqué votre appel… » —
  « assistant » est honnête sans dire « robot ».
- Interdire au prompt de **nier** être un système automatisé si on le lui demande (aujourd'hui
  c'est l'inverse qui est demandé).
- Garder l'interdiction du jargon (« IA », « bot ») : neutralité ≠ mensonge.
- Mettre à jour `techStack.md` (règle de vocabulaire) et `qualification.ts` en conséquence.

### 5-2 · RGPD

- **Fait et bien fait** : purge 12 mois, opt-out, hébergement UE, minimisation.
- **Manquant** :
  - Registre des traitements (obligation art. 30 — un tableau suffit) et qualification des
    rôles : chaque artisan = responsable de traitement, vous = sous-traitant → il faut un
    **DPA (contrat de sous-traitance)** signé avec chaque client. C'est aussi un argument de vente.
  - DPA avec Twilio (US) : signer le Data Protection Addendum Twilio + documenter les SCC.
    `techStack.md` note déjà Bird comme alternative UE — bonne réflexivité, à garder sous le coude.
  - Information des personnes : la politique de confidentialité doit être accessible depuis le
    premier SMS (un lien court vers rappl.be/privacy) ou au minimum sur le site.
  - Landing rappl.be : ajouter pages mentions légales + politique de confidentialité (absentes
    du code actuel — `src/app/` ne contient que `page.tsx`, `login` et `dashboard`).

### 5-3 · Télécom / prospection

Le SMS post-appel manqué est une réponse à une sollicitation entrante (l'appelant a appelé) :
défendable comme intérêt légitime, et la mention STOP est déjà là. Garder une trace horodatée
de l'appel entrant (déjà fait via `Call`) comme preuve de la sollicitation.

---

## 6. Constats P2 — améliorations

- **Tests** : bonne base unitaire, mais aucun test d'intégration du chemin critique complet
  (webhook voice → SMS → webhook sms → LLM mocké → lead → alerte). Un seul test de bout en bout
  avec la DB de dev attraperait les régressions les plus coûteuses.
- **`detectLanguage`** appelé sur chaque message : vérifier le comportement sur messages courts
  (« ok », « oui ») pour ne pas faire basculer la langue de la conversation par erreur.
- **Landing page** : le compteur « appels captés » et les témoignages devront être réels avant
  commercialisation (pas de chiffres inventés — voir Omnibus/pratiques trompeuses).
- **Seed en prod** : `prisma/seed.ts` crée des comptes de test — s'assurer qu'il ne tourne
  jamais en prod (le garder hors du service `migrate`).
- **Dette mineure** : warning Node 20 déprécié dans les actions GitHub (`appleboy/ssh-action`,
  `actions/checkout@v4`) — mettre à jour tranquillement.

---

## 7. Volet business (Rappl + AutoWebsite)

### 7-1 · Constat : deux business en parallèle, aucun business plan écrit

Il n'existe de business plan formalisé dans aucun des deux dépôts. Les seuls éléments chiffrés
sont les coûts (AICOSTS.md : LLM ~1-2 €/client/mois, SMS dominant) et un plan `plus` à
+39 €/mois. **Le prix du plan de base n'est écrit nulle part.** C'est la première chose à fixer.

Rappl (SaaS récurrent, artisans BTP) et AutoWebsite (usine à sites, coiffeurs) visent la même
clientèle TPE locale mais sont deux métiers : l'un se vend en abonnement avec un ROI mesurable,
l'autre en one-shot avec un besoin de volume commercial permanent. Mener les deux de front à
deux personnes = dilution.

**Recommandation : faire d'AutoWebsite l'aimant, de Rappl le produit.** Le site offert ou à
prix coûtant est la porte d'entrée (« on vous a préparé une maquette de site, regardez ») ;
l'abonnement Rappl est le revenu récurrent (« et voici combien d'appels vous perdez par mois »).
Une seule cible au départ : un métier, une zone (ex. plombiers/chauffagistes Hainaut ou
Eurométropole), pour que le bouche-à-oreille fonctionne.

### 7-2 · Économie unitaire à écrire noir sur blanc (hypothèses à valider au pilote)

| Poste | Hypothèse | Par client / mois |
|---|---|---|
| Prix de vente (à fixer) | 59–99 € HTVA | 59–99 € |
| Numéro Twilio BE | ~1–5 € | ~3 € |
| SMS (~40 conv. × 6 SMS × ~0,09 €) | volume pilote | ~20 € |
| LLM (AICOSTS) | Haiku + caching | ~1–2 € |
| Infra (VPS mutualisé sur N clients) | 15 €/N | ~1 € |
| **Marge brute** | | **~55–75 %** |

Le SMS est le coût qui scale avec l'usage : envisager un plafond d'usage équitable dans les CGV
(ex. 60 conversations/mois incluses) pour se protéger d'un client à très fort volume.

### 7-3 · Go-to-market : les contacts servent à distribuer, pas à vendre

Les acheteurs de Rappl sont des artisans à 60-100 €/mois : aucune personnalité, si haut placée
soit-elle, ne signe à leur place. En revanche un réseau fort est un **canal de distribution**
excellent si on le pointe au bon endroit :

1. **D'abord la preuve** : 5–10 clients pilotes payants, 60–90 jours, avec le chiffre magique
   par client : « X appels récupérés, Y devis envoyés, Z € de chantiers ». Sans ça, aucun
   contact ne peut rien pour vous ; avec ça, tous les canaux s'ouvrent.
2. **Ensuite les prescripteurs** : fédérations professionnelles (Confédération Construction,
   UCM, Embuild), comptables de TPE, assureurs, grossistes en matériel — un partenariat avec un
   seul de ces relais vaut mieux que cent rendez-vous prestigieux.
3. **Les contacts haut niveau** (politiques ou autres) sont utiles pour : introductions vers
   des fédérations, visibilité presse locale, éventuels dispositifs de digitalisation des TPE
   (chèques-entreprises wallons, subventions numériques) — pas pour la vente directe.

### 7-4 · KPI à suivre dès le pilote

- Appels manqués captés / client / mois (le chiffre ROI, déjà prévu dans le récap — très bien).
- Taux de réponse au 1er SMS ; taux de conversations → lead qualifié ; délais de rappel.
- Churn mensuel et raison de départ.
- Coût SMS+LLM réel / client (à comparer aux hypothèses ci-dessus chaque mois).

### 7-5 · Risques business à documenter dans le plan

- **Dépendance Twilio** (prix, conformité data US) — l'alternative Bird est déjà notée, bien.
- **Concurrence** : les standards téléphoniques IA (voix) arrivent vite sur ce segment ;
  votre différenciation est le SMS-first (pas d'installation, pas de changement de numéro,
  prix plancher) — l'écrire et la défendre.
- **Réglementaire** : AI Act (voir §5-1) — transformer la contrainte en argument
  (« conforme AI Act / RGPD, hébergé en UE » rassure les fédérations et les comptables).

---

## 8. Plan d'action priorisé

| # | Action | Effort | Priorité |
|---|---|---|---|
| 1 | Configurer les secrets VPS + chaîner Deploy après CI | 1 h | P0 |
| 2 | Sauvegardes Postgres quotidiennes chiffrées + test de restauration | 2-3 h | P0 |
| 3 | SMS initial persisté en DB, exécuté par le worker | 0,5-1 j | P0 |
| 4 | Idempotence MessageSid + réponse 200 immédiate + traitement async | 0,5-1 j | P0 |
| 5 | Mise en conformité AI Act du prompt + vocabulaire produit | 2 h | P0 (avant pilote) |
| 6 | Refus des secrets par défaut au démarrage + timingSafeEqual | 1 h | P1 |
| 7 | Rate limit login + variantes STOP + Advanced Opt-Out Twilio | 0,5 j | P1 |
| 8 | Stripe payment_failed → alerte + pause après N échecs | 2 h | P1 |
| 9 | Headers sécurité Caddy + healthchecks Docker + uptime externe | 2 h | P1 |
| 10 | Mentions légales + privacy sur la landing ; DPA Twilio ; registre RGPD | 0,5 j | P1 |
| 11 | Fixer le prix du plan base + écrire le business plan 1 page (§7) | 0,5 j | P1 |
| 12 | Test d'intégration bout-en-bout du chemin critique | 1 j | P2 |
