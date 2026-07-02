# AUDIT.md — Audit complet : application, site web, business plan

> Audit réalisé le 2026-07-02 sur la branche `claude/website-app-audit-797pje`.
> Périmètre : tout le code (`src/`, `worker/`, infra), la landing page, et les
> documents business (`mvp.md`, `techStack.md`, `AICOSTS.md`, `MANIP.md`).
> Chaque constat est accompagné d'une solution concrète et d'une priorité :
> **P0** = à corriger avant le 1er client pilote · **P1** = avant de vendre à plusieurs clients · **P2** = amélioration.

---

## Synthèse exécutive

Le produit est **remarquablement bien structuré pour un MVP** : multi-tenant propre,
signatures webhook vérifiées, coûts LLM maîtrisés, discipline documentaire rare.
Mais il y a **7 problèmes bloquants (P0)** avant de mettre un vrai client dessus :

| # | Problème | Impact |
|---|---|---|
| 1 | Le SMS initial repose sur un `setTimeout` en mémoire | Chaque redéploiement/crash perd des SMS → des clients finaux jamais recontactés, en silence |
| 2 | L'opt-out STOP ne reconnaît que le mot exact « STOP » | « Stop », « STOP. », « stop svp » sont ignorés → violation légale de l'opt-out |
| 3 | Les webhooks Twilio ne sont pas idempotents | Un retry Twilio → erreur 500 → nouveaux retries → réponses SMS en double |
| 4 | Après un handoff, les SMS du client final sont jetés | Perte de messages clients sans trace — l'inverse de la promesse produit |
| 5 | Piège de config : la signature Twilio se valide avec l'**Auth Token**, pas une « signing key » | Suivre `MANIP.md` tel quel → tous les webhooks rejetés en 403 dès le jour 1 |
| 6 | Aucune page légale (mentions, confidentialité, CGV) et CTA `mailto:` uniquement | Non conforme pour un site commercial belge + conversion quasi nulle |
| 7 | Le prix de l'offre de base n'est défini **nulle part** | Impossible de valider la marge, de vendre, ou de configurer Stripe |

Le reste de l'audit détaille ~40 constats classés par domaine.

---

## 1. Sécurité applicative

### S1 — Token API statique = accès admin global éternel — **P1**
`src/lib/api/auth.ts:18` : `API_SECRET_KEY` est comparé avec `===` et donne un accès
admin total (`clientId: "*"`) sur toute l'API. Problèmes :
- **Comparaison non constante dans le temps** → vulnérable en théorie aux attaques par timing. Utiliser `crypto.timingSafeEqual`.
- **Un seul token, pas de rotation, pas de scoping** : si le token fuit (log, script, app mobile décompilée), tout le SaaS est ouvert. L'app mobile prévue ne doit JAMAIS embarquer ce token.
- **Solution** : table `ApiToken` (hash du token, `clientId`, `role`, `expiresAt`, `revokedAt`) + endpoint de login qui émet un JWT court pour le mobile. Le token statique peut rester pour vos scripts internes, mais scopé et révocable.

### S2 — Aucun rate limiting nulle part — **P1**
- `/login` : brute-force possible sans limite (bcrypt ralentit, mais rien ne bloque).
- Webhook voice : un attaquant qui connaît le numéro Twilio peut déclencher des appels en masse → SMS sortants en masse = **toll fraud / SMS pumping**, la fraude n°1 sur Twilio. Chaque SMS coûte de l'argent.
- **Solutions** :
  - Limiter les tentatives de login par IP + email (ex. 5/15 min) — un middleware simple avec compteur Postgres suffit (pas de Redis, cf. règle anti-sur-ingénierie).
  - Garde-fou métier : max N SMS initiaux par numéro appelant par jour, max M par client par heure ; alerte si dépassement.
  - Activer les protections Twilio : Geo Permissions (limiter aux numéros BE/FR/NL), alertes de dépense, et un plafond de budget mensuel sur le compte.

### S3 — Détection STOP trop stricte = risque légal — **P0**
`src/app/api/v1/webhooks/twilio/sms/route.ts:53` : `messageBody.trim().toUpperCase() === "STOP"`.
« Stop. », « STOP SVP », « stop aub », « arrêt », « uitschrijven » ne déclenchent rien : le bot **continue de répondre à quelqu'un qui s'est désinscrit**. En Belgique/France c'est une violation directe de l'opt-out (et votre propre `techStack.md §11` l'exige « immédiat »).
- **Solution** : normaliser (minuscules, ponctuation retirée) et matcher le premier mot contre une liste : `stop`, `arret`, `arrêt`, `desinscription`, `uit`, `uitschrijven`, `stoppen`. Vérifier aussi que le numéro Twilio a l'Advanced Opt-Out activé côté console (Twilio bloque alors en amont — mais votre base doit rester la source de vérité).
- Bonus : gérer **START/UNSTOP** pour la réinscription (aujourd'hui l'opt-out est définitif, aucune route ne retire l'entrée).

### S4 — Webhooks non idempotents malgré la règle du repo — **P0**
`agents.md §5` impose « les handlers de webhook tolèrent les rejeux Twilio ». Or :
- Voice : un retry avec le même `CallSid` viole l'unique `twilioCallSid` → exception → 500 → Twilio re-retry → boucle. `src/lib/calls/service.ts:41`.
- SMS : idem sur l'unique `twilioSid` de `Message` (`recordMessage` ligne 88 du webhook, hors du try/catch) → 500 → retry → si le premier passage avait déjà envoyé la réponse LLM, le client final peut recevoir **deux réponses**.
- **Solution** : `upsert` sur `twilioCallSid` / vérifier l'existence du `MessageSid` en tête de handler et répondre 200 immédiatement si déjà traité.

### S5 — En-têtes de sécurité HTTP absents — **P1**
`Caddyfile` = 2 lignes, aucun header. Ajouter :
```
{$APP_DOMAIN} {
  encode gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
  reverse_proxy app:3000
}
www.{$APP_DOMAIN} {
  redir https://{$APP_DOMAIN}{uri} permanent
}
```

### S6 — `/api/health` public révèle la configuration — **P2**
`src/app/api/health/route.ts` liste les noms des variables d'env manquantes à quiconque.
Faible gravité, mais inutile : réserver le détail aux requêtes authentifiées, ne renvoyer publiquement que `{status}`.

### S7 — L'admin « api-token » casse les FK — **P2**
`getAuthedUser` renvoie `userId: "api-token"` ; toute route qui écrit `authorId`
(notes, messages client) plantera avec ce pseudo-utilisateur. Créer un vrai `User` système ou interdire ces routes au token statique.

### S8 — PII dans les logs — **P1**
La règle est « jamais de contenu SMS en clair » (respectée ✔), mais les **numéros de
téléphone** (PII au sens RGPD) sont loggés partout (`callerNumber` dans ~15 appels logger).
Pseudonymiser en prod : logger les 4 derniers chiffres (`…0001`) ou un hash court.

---

## 2. Fiabilité & bugs métier

### F1 — SMS initial planifié en mémoire (`setTimeout`) — **P0, le plus grave**
`src/lib/calls/service.ts:81`. Le délai de 30 s vit dans le process Next.js :
- **Chaque déploiement** (`docker compose up -d` = restart du conteneur) perd tous les SMS en attente. Vous déployez à 14h02, l'appel manqué de 14h01:45 ne recevra jamais son SMS — invisible, aucun log d'erreur.
- Crash / OOM / scale à 2 instances = même problème.
- C'est le **cœur de la promesse produit** (« un SMS part sous 30 s ») qui repose sur le mécanisme le plus fragile du code.
- **Solution (sans Redis, conforme à techStack §7)** : ajouter un modèle `ScheduledJob` (`id, type, payload, runAt, doneAt, attempts`) ; le webhook voice insère une ligne `runAt = now + délai` ; le **worker** (qui existe déjà) poll toutes les 10 s les jobs dus et envoie le SMS. Redémarrage = rien n'est perdu. ~1 h de travail.

### F2 — Après handoff, les SMS entrants sont silencieusement jetés — **P0**
`findOpenConversationByCallerNumber` ne cherche que `open`/`qualified`. Une conversation
`handed_off` (cas fréquent : client frustré ou > 6 tours — précisément les cas sensibles) :
le SMS suivant du client final ne matche aucune conversation → « ignoré » (webhook SMS ligne 83).
**Ni enregistré, ni notifié.** Le patron croit avoir le fil complet dans le dashboard, il lui manque des messages.
- **Solution** : inclure `handed_off` dans la recherche ; enregistrer le message ; ne pas appeler le LLM (déjà le cas via `autopilot`/état) ; envoyer une alerte « le client a répondu, rappelez-le ».

### F3 — Les réponses manuelles de l'artisan sont tronquées à 160 caractères en silence — **P0**
La route reply accepte 1000 caractères (`conversations/[id]/reply/route.ts:12`), puis
`sendSms` → `enforceSingleSegment` **tronque à un segment** (`src/lib/sms/service.ts:14`).
L'artisan tape 3 phrases, le client final n'en reçoit qu'une et demie. Le garde-fou de coût
est pensé pour le bot, pas pour un humain qui a explicitement écrit son message.
- **Solution** : paramètre `allowMultiSegment: true` pour les envois manuels (assainir GSM-7, garder le texte entier), et afficher le compteur de segments dans l'UI de réponse.

### F4 — Deux SMS rapprochés = deux pipelines LLM concurrents — **P1**
Aucun verrou : si le client final envoie deux SMS en 5 s (très courant), deux webhooks
traitent la même conversation en parallèle → deux appels LLM, deux réponses, `turnCount` faux.
- **Solution** : advisory lock Postgres par conversation (`pg_advisory_xact_lock(hashtext(conversationId))`) ou un débounce de quelques secondes qui regroupe les messages (P2-T5 « regroupement » était prévu, il n'existe pas réellement).

### F5 — Une conversation `qualified` reste en autopilot sans fin — **P1**
Après `complete=true`, l'état passe à `qualified` mais la conversation reste trouvable et
le LLM continue de répondre à chaque SMS jusqu'au plafond de 6 tours. Comportement voulu ?
À trancher : soit clôturer après qualification + message final (« on vous rappelle »), soit
c'est assumé — mais alors documentez-le.

### F6 — Purge RGPD incomplète — **P1**
`worker/jobs/rgpdPurge.ts` purge à partir des **conversations**. Un appel manqué **sans
conversation** (numéro whitelisté, SMS jamais envoyé, appelant n'ayant jamais répondu… le cas
majoritaire !) garde son `callerNumber` **pour toujours**. La politique « 12 mois » annoncée
n'est pas tenue.
- **Solution** : deuxième passe `db.call.deleteMany({ where: { calledAt: { lt: cutoff } } })` (les FK conversations ont déjà été purgées).
- Nettoyer aussi `ClientMessage`/`ClientNote` si un client (tenant) est supprimé — aujourd'hui aucune suppression de tenant n'existe (droit à l'effacement RGPD non implémentable).

### F7 — Piège mortel de configuration Twilio — **P0 (documentation)**
`twilio.validateRequest(signingKey, …)` (`src/lib/twilio/signature.ts:14`) attend **l'Auth
Token principal du compte**. Or `MANIP.md §2` dit de créer « une clé de signature webhook »
dans la console — ça n'existe pas sous cette forme ; si vous mettez autre chose que l'Auth
Token dans `TWILIO_WEBHOOK_SIGNING_KEY`, **100 % des webhooks seront rejetés en 403** et
aucun SMS ne partira jamais. Corriger `MANIP.md` : `TWILIO_WEBHOOK_SIGNING_KEY = TWILIO_AUTH_TOKEN`
(ou supprimer la variable et utiliser directement l'Auth Token).
- Attention aussi : l'URL signée est reconstruite depuis `APP_BASE_URL` — le moindre écart
  (slash final, http vs https, www) casse la validation. Ajouter un test de bout en bout au go-live.

### F8 — Message vocal toujours en français et parfois mensonger — **P2**
Le TwiML dit « Vous allez recevoir un message » même si le numéro est whitelisté/opt-out
(aucun SMS ne suivra) et toujours en français (cible NL de l'Eurométropole). Faire précéder
d'un check whitelist + variante NL selon la langue par défaut du tenant.

### F9 — Premier SMS toujours en français — **P2**
`scheduleInitialSms` appelle `buildInitialSmsBody(clientId)` sans langue → défaut `fr`.
Un artisan de Kortrijk avec une clientèle NL enverra toujours le premier SMS en français.
Ajouter `defaultLanguage` sur `Client`.

### F10 — Emails via Gmail SMTP : fragile pour un produit payant — **P1**
`techStack.md` dit Resend, le code fait du Gmail SMTP. Gmail : ~500 mails/jour max, risque
spam élevé (pas de SPF/DKIM sur votre domaine), compte bloqué si volume anormal. Or l'alerte
lead et le récap quotidien sont **le** livrable de rétention. Passer à Resend/Brevo avec le
domaine `rappl.be` vérifié (SPF+DKIM+DMARC) avant le pilote — c'est 1 h de travail.
Mettre `techStack.md` à jour (journal des décisions) dans tous les cas : doc et code se contredisent.

### F11 — Divers (P2)
- `ROI` : timezone codée en dur `Europe/Brussels` au lieu de celle du client ; « CA estimé » basé sur une constante 800 € codée en dur — rendre configurable par client, c'est l'argument de vente n°1.
- `BusinessHours` : pas de pause déjeuner (une seule plage/jour), pas d'horaires chevauchant minuit.
- `requireAuth` est un alias trompeur de `getAuthedUser` (ne « require » rien).
- Pas de suppression/désactivation de client ni d'utilisateur (offboarding impossible).
- `docker-compose` : Postgres sans backup automatisé. **Un `pg_dump` quotidien vers un stockage externe (Hetzner Storage Box) est indispensable avant le 1er client** — aujourd'hui, un disque VPS perdu = toutes les données clients perdues. → à classer **P0 opérationnel**.

---

## 3. RGPD & conformité juridique

### J1 — Aucune page légale sur le site — **P0**
Site commercial belge : **mentions légales** (dénomination, n° BCE, siège, contact) et
**politique de confidentialité** sont obligatoires. Il n'existe ni `/mentions-legales`, ni
`/confidentialite`, ni CGV/CGU. Sans ça, pas de crédibilité face à un client pro, et une
non-conformité opposable.
- **Solution** : 3 pages statiques + liens footer. Les CGV doivent notamment définir la
  garantie « remboursé si aucun client capté » (voir B3).

### J2 — Rôles RGPD non posés : vous êtes **sous-traitant** — **P0 (contractuel)**
Les données traitées (numéros et messages des appelants) appartiennent à l'artisan
(responsable de traitement). Il vous faut un **DPA (accord de sous-traitance, art. 28 RGPD)**
signé avec chaque client, listant vos propres sous-traitants (Twilio, Anthropic, Hetzner,
Google/SMTP, Stripe, Sentry) et les transferts hors UE (SCC). Un template une fois rédigé
se réutilise pour tous les clients.
- Le claim « Hébergé en Europe » de la landing est vrai pour le VPS mais **les SMS (Twilio)
  et le LLM (Anthropic) transitent par des processeurs américains**. Ne pas sur-promettre :
  reformuler (« Données hébergées en Europe ; prestataires sous clauses contractuelles types »)
  ou ça vous sera opposé par le premier client un peu regardant.

### J3 — Le bot se fait passer pour un humain : risque AI Act — **P0 (décision fondateurs)**
Le system prompt impose : « Vous représentez de vraies personnes du bureau, jamais un
programme » (`src/lib/llm/qualification.ts:47`), et la landing promet « jamais un robot ».
Le **règlement européen sur l'IA (AI Act), art. 50** impose d'informer les personnes qu'elles
interagissent avec un système d'IA — obligation applicable **à partir d'août 2026**, c'est-à-dire
dans deux mois. Nier être un programme si on le demande est exactement ce que le texte vise.
- **Solution pragmatique** : ne jamais *affirmer* être humain ; si l'appelant demande
  explicitement, répondre « c'est le service de messagerie automatisé de [Entreprise], un
  collaborateur vous rappelle » + `needs_human=true`. Une ligne de prompt à changer, et une
  mention « service de réponse automatisée » dans la politique de confidentialité. Le
  positionnement « secrétariat » reste vendable côté artisan sans mentir à l'appelant.
  **À valider avec un avocat — c'est un risque existentiel si un concurrent ou un client mécontent le signale.**

### J4 — L'appelant final n'est jamais informé du traitement — **P1**
Art. 13/14 RGPD : la personne dont on traite les données doit pouvoir accéder à
l'information. Ajouter dans le premier SMS ou en signature un lien court vers
`rappl.be/p` (page d'info privacy destinée aux appelants). Beaucoup le font via « Infos :
rappl.be/p » — 15 caractères.

---

## 4. Site web (landing)

### W1 — Conversion : le CTA principal est un `mailto:` — **P0**
`page.tsx:516` : « Réserver ma démo » ouvre le client mail. Pour une cible **artisans sur
mobile**, c'est le canal qui convertit le moins (pas de client mail configuré, friction
maximale). De plus l'adresse est `contact@rappl.eu` alors que le domaine produit est
**rappl.be** — incohérence qui sent le projet non fini.
- **Solutions** (dans l'ordre d'impact) :
  1. **Numéro de téléphone cliquable** (`tel:`) — votre cible appelle, elle n'écrit pas. Et ça vous permet de faire une démo du produit en live : ne décrochez pas, laissez Rappl répondre. **La meilleure démo possible du produit, c'est votre propre numéro.**
  2. Formulaire court (nom, métier, téléphone) → crée un lead chez vous + SMS de confirmation immédiat envoyé par Rappl lui-même (dogfooding visible).
  3. Lien Calendly/Cal.com pour la démo planifiée.
  4. Unifier sur une seule adresse (`contact@rappl.be`).

### W2 — `lang="en"` sur un site 100 % français — **P0 (1 minute)**
`src/app/layout.tsx:31`. Pénalise SEO et lecteurs d'écran. → `lang="fr"`.

### W3 — SEO quasi absent — **P1**
- Pas de `robots.txt`, pas de `sitemap.xml`, pas de `metadataBase`, pas d'Open Graph/Twitter card (un partage WhatsApp — canal n°1 des artisans — n'affichera aucun aperçu), pas d'image OG.
- Pas de données structurées JSON-LD (`LocalBusiness`/`Service`) alors que le ciblage est géographique (« Eurométropole », « Mouscron »).
- Une seule page : aucune chance de ranker sur « secrétariat téléphonique artisan », « appel manqué plombier », etc. Prévoir 2-3 pages métier (plombier/électricien/toiturier) à moyen terme — contenu quasi identique, ciblage long-tail local.
- **Solutions** : `app/robots.ts`, `app/sitemap.ts`, bloc `openGraph`+`twitter` dans metadata, image OG 1200×630, JSON-LD dans `page.tsx`.

### W4 — Version néerlandaise absente — **P1**
La landing vante « FR/NL — pensé pour l'Eurométropole Lille–Kortrijk–Tournai » mais le site
n'existe qu'en français. Pour vendre à Kortrijk, il faut `/nl` (le produit gère déjà le NL,
l'argument est réel). Next.js i18n ou simple duplication `/nl/page.tsx` au début.

### W5 — Aucune preuve sociale ni source — **P1**
- « 80 % des appels manqués ne laissent aucun message » : sans source, un sceptique classe
  tout le discours comme du vent. Sourcer (études télécom existantes) ou reformuler (« la
  plupart »).
- Zéro témoignage/logo — normal pré-pilote, mais c'est **la** raison d'offrir le pilote
  (P8-T4 le prévoit). Dès le premier client : photo, prénom, métier, chiffre (« 11 appels
  captés le premier mois »).
- Ajouter une section FAQ (objections : « et si le client n'aime pas les SMS ? », « qui écrit
  les messages ? », « combien ça coûte ? », « ça marche avec mon opérateur ? ») — utile pour
  la conversion ET le SEO.

### W6 — Pas de prix sur le site — **P1 (décision commerciale)**
Aucune section tarif. Défendable en vente directe, mais les artisans détestent « prix sur
demande » (ça sent le devis gonflé). Au minimum : « à partir de X €/mois, sans engagement »
dans la section garantie. Voir B1 : le prix n'est de toute façon défini nulle part.

### W7 — Accessibilité & finitions — **P2**
- Contrastes faibles (`text-white/40`, `/45`, `/50` sur fond noir : sous les 4,5:1 WCAG AA pour du texte informatif).
- Animations (`Reveal`, `CountUp`, `float`, `pulse`) sans respect de `prefers-reduced-motion`.
- Icônes de navigation dashboard en emoji (`👥`, `🚀`) : rendu incohérent selon OS ; utiliser lucide comme partout ailleurs.
- Pas de page 404 personnalisée.
- Le compteur « ≈ 4 000 € » : le calcul (5 appels × 1/4 × 800 € × 4,33 semaines) est cohérent, mais afficher les hypothèses en petit sous le bloc renforce la crédibilité (« 5 appels manqués/sem × 25 % de signature × 800 € »).

### W8 — Observabilité produit absente — **P2**
PostHog est prévu (`techStack.md §10`) mais non installé : vous ne saurez pas combien de
visiteurs scrollent jusqu'au CTA ni d'où ils viennent. À installer avant toute dépense
d'acquisition (flyers, ads locales).

---

## 5. Business plan

### B1 — Le prix de base n'existe pas — **P0**
Le pricing est mentionné une seule fois : « base (inclus) · plus (+39 €/mois) » — **le prix
du plan de base n'est écrit nulle part** (ni docs, ni site, ni Stripe seedé). Impossible de
valider la marge, de faire un pitch, ou de répondre à la première question de n'importe quel
prospect/investisseur.
- **Recommandation** : positionnez-vous contre les deux alternatives réelles de l'artisan :
  un secrétariat téléphonique humain (150–300 €/mois en Belgique) et « ne rien faire »
  (0 €, coût caché ~4 000 €/mois selon votre propre calcul). Un prix de **79–129 €/mois**
  est cohérent : ~10× moins cher qu'une secrétaire, remboursé par un seul chantier capté.
  Testez 99 €/mois au pilote, ajustez.

### B2 — Les unit economics ne sont pas chiffrés de bout en bout — **P0**
`AICOSTS.md` est excellent sur le LLM (~0,50 $/client/mois) mais dit lui-même « le coût
dominant reste les SMS » **sans jamais chiffrer les SMS**. À poser noir sur blanc (ordre de
grandeur à vérifier sur vos tarifs Twilio réels) :

| Poste (par client/mois) | Hypothèse | Coût estimé |
|---|---|---|
| Numéro belge Twilio | 1 | ~1–7 € |
| SMS sortants (~50 conv. × ~4 SMS) | ~200 SMS × ~0,08–0,11 € | **~16–22 €** |
| Minutes voix entrantes (renvoi) | ~50 appels × 30 s | ~1–2 € |
| LLM (Haiku, cf. AICOSTS) | | ~0,50 € |
| Email, infra (VPS mutualisé) | | ~1–2 € |
| **COGS total** | | **~20–33 €/client/mois** |

À 99 €/mois → marge brute ~65–80 %. Correct pour du SaaS avec composante télécom, **mais
sensible au volume de SMS** : un client à 150 appels manqués/mois peut devenir déficitaire.
- **Solutions** : (1) plafond d'usage raisonnable dans les CGV (« jusqu'à X conversations/mois,
  au-delà Y € »), (2) suivre le COGS réel par tenant dès le pilote (les données sont en base :
  compter les messages), (3) noter que l'artisan paie aussi le renvoi d'appel à son opérateur
  (souvent inclus dans les forfaits pro, à vérifier par opérateur — question qu'on vous posera).

### B3 — La garantie « remboursé si aucun client capté » n'est pas définie — **P0**
Qu'est-ce qu'un « client capté » ? Un lead qualifié ? Un rappel effectué ? Un chantier signé
(que vous ne pouvez pas mesurer) ? Sans définition contractuelle, c'est un litige garanti
avec le premier client déçu. Définir dans les CGV : « au moins un lead qualifié transmis
(type + coordonnées + besoin) pendant le premier mois ». C'est mesurable dans votre base et
presque toujours atteint — la garantie reste un vrai argument sans être un risque.

### B4 — Pas d'analyse concurrentielle écrite — **P1**
Rien dans les docs sur : les secrétariats téléphoniques classiques (Officéo, télésecrétariats
belges, ~150–300 €/mois), la messagerie vocale améliorée des opérateurs, les solutions
US/UK du même créneau exact (Podium, NumberAI, « missed-call-text-back » vendu par des
centaines d'agences), et les CRM artisans qui ajoutent cette brique. Votre différenciation
réelle : **local, FR/NL, qualification conversationnelle (pas juste un SMS statique), prix,
et zéro installation**. À écrire en une page — c'est la première question d'un investisseur
ou d'un acheteur.

### B5 — Go-to-market : le réseau ne suffit pas, préparez le canal répétable — **P1**
Vendre les premiers clients via vos contacts est le bon départ (et un carnet d'adresses
bien rempli aide énormément). Mais un business plan « parfait » doit montrer le canal
**répétable** derrière :
- **La démo est le produit** : appelez le prospect, ne décrochez pas, il reçoit le SMS de
  qualification en 30 s. Coût d'acquisition quasi nul, effet immédiat.
- Partenariats prescripteurs : comptables d'artisans, grossistes matériaux, fédérations
  (Confédération Construction, UCM, Bouwunie côté flamand), assureurs pro.
- Le récap quotidien envoyé au patron est votre anti-churn : chaque soir il voit « X € de
  chantiers captés » — gardez ce chiffre au centre de l'email.
- Métriques à suivre dès le pilote : taux de réponse au 1er SMS, taux conversation→lead,
  taux lead→rappel effectué, churn mensuel, COGS/tenant. (Le schéma de données permet déjà
  de toutes les calculer ; `stats` de P8-T3 en couvre une partie.)

### B6 — Risques structurels à documenter (une ligne chacun suffit) — **P1**
- **Dépendance Twilio** : prix SMS BE en hausse constante, exigences A2P croissantes. L'alternative Bird est déjà notée — bien.
- **AI Act / transparence** (voir J3) : à trancher avant de scaler, pas après.
- **Concentration géographique** : l'Eurométropole est un bon faisceau, mais le produit n'a aucune limite géographique réelle — la Wallonie entière parle français, prévoyez-le dans le plan.
- **Équipe de 2** : le bus factor est de 1 côté technique. Les runbooks (`MANIP.md`) et les backups (F11) sont votre assurance-vie.
- **Statut juridique** : société constituée ? Assurance RC pro ? À cocher avant le premier contrat signé.

---

## 6. Plan d'action priorisé

### P0 — avant le premier client pilote (~2-3 jours de dev + décisions)
1. **F1** : jobs SMS persistants dans le worker (fin du `setTimeout`).
2. **S3** : matching STOP élargi FR/NL + gestion START.
3. **S4** : idempotence des deux webhooks Twilio.
4. **F2** : conversations `handed_off` — enregistrer les réponses + alerter.
5. **F3** : réponses manuelles non tronquées.
6. **F7** : corriger `MANIP.md` (Auth Token) + test webhook de bout en bout.
7. **F11** : backup Postgres quotidien externalisé.
8. **J1/J2/J3** : pages légales + template DPA + décision transparence IA (prompt à ajuster).
9. **W1/W2** : CTA téléphone + formulaire, adresse unifiée, `lang="fr"`.
10. **B1/B2/B3** : fixer le prix, chiffrer le COGS SMS, définir « client capté » dans les CGV.

### P1 — avant de dépasser ~5 clients
Rate limiting + garde-fous anti-fraude SMS (S2) · tokens API scopés (S1) · headers sécurité
(S5) · verrou anti-concurrence LLM (F4) · purge RGPD complète (F6) · Resend + domaine email
vérifié (F10) · SEO de base + OG + version NL (W3/W4) · preuve sociale du pilote (W5) ·
page concurrence + métriques (B4/B5) · info privacy appelants (J4) · PII hors des logs (S8).

### P2 — confort / croissance
Health endpoint discret (S6) · TwiML NL (F8/F9) · accessibilité et reduced-motion (W7) ·
PostHog (W8) · panier moyen configurable dans le ROI (F11) · pages métier SEO locales ·
offboarding client (droit à l'effacement).

---

## Ce qui est déjà très bien (à garder tel quel)

- Vérification systématique des signatures Twilio et Stripe.
- Isolation multi-tenant disciplinée (scoping `clientId` quasi partout, revue P7-T1 visible).
- Architecture API-first réellement tenue (le dashboard consomme `/api/v1`).
- Maîtrise des coûts LLM exemplaire (`AICOSTS.md` + implémentation conforme : Haiku, prompt
  caching, tool use forcé, `max_tokens: 300`, 1 appel/tour, plafond 6 tours).
- Assainissement GSM-7 des SMS (rare de le voir fait correctement).
- Discipline documentaire (`agents.md`, journal de décisions) — c'est ce qui a rendu cet
  audit rapide, et c'est un actif si vous levez des fonds ou recrutez.
