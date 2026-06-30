# mvp.md — Plan du projet par phases

> Ce fichier est le **plan de route** et le **suivi d'avancement**.
> Les agents le lisent au démarrage, prennent la prochaine tâche non cochée, l'implémentent,
> cochent la case, et **mettent à jour le bloc « ÉTAT ACTUEL »** ci-dessous.
> Les IDs de tâche (ex. `P2-T3`) servent de référence dans les commits et les PR.

---

## ÉTAT ACTUEL  ← (mis à jour par l'agent à chaque tâche terminée)

```
Phase en cours    : P0 — Fondations
Dernière tâche OK : P0-T5
Prochaine tâche   : P0-T3 (migration) puis P0-T6
Bloqueurs         : P0-T3 bloquée — migration à relancer avec `pnpm db:migrate` quand Docker tourne
Mis à jour le     : 2026-06-30
```

---

## Légende

- ★ = strict minimum pour le **lancement MVP** (le « vrai » MVP s'arrête à la fin de la Phase 5).
- ☐ / ☑ = à faire / fait.
- Chaque phase a un **but**, des **tâches**, des **critères d'acceptation**, et un **hors-scope**.

---

## Phase 0 — Fondations ★

**But :** un squelette qui tourne, déployé, avec un tenant de test en base.

- ☑ **P0-T1** Initialiser le repo (pnpm, TypeScript strict, Next.js App Router, Tailwind + shadcn/ui).
- ☑ **P0-T2** Mettre en place Prisma + `schema.prisma` (toutes les tables du modèle de `techStack.md §3`).
- ☐ **P0-T3** Connecter docker et DB SQL+ première migration.
- ☑ **P0-T4** Worker séparé (`/worker`) avec un cron vide qui démarre.
- ☑ **P0-T5** Dockeriser (`app` + `worker`) + Docker Compose + Caddy.
- ☐ **P0-T6** Pipeline GitHub Actions (lint + test + build) + déploiement VPS Hetzner EU.
- ☐ **P0-T7** Seed : un `Client` de test + un `User` admin + un `PhoneNumber` factice.
- ☐ **P0-T8** Établir la convention **API v1** (REST/JSON versionné sous `/api/v1`, auth par jeton) que le dashboard ET la future app mobile consommeront. Voir `techStack.md §8.5`.

**Acceptation :** l'app et le worker tournent en local et sur le VPS ; la base contient le tenant de test ; CI verte.
**Hors-scope :** toute logique métier.

---

## Phase 1 — Captation des appels ★

**But :** détecter et journaliser chaque appel manqué.

- ☐ **P1-T1** Acheter/configurer un numéro Twilio belge ; documenter le renvoi conditionnel côté client.
- ☐ **P1-T2** Endpoint webhook Twilio Voice (vérif. signature `X-Twilio-Signature`).
- ☐ **P1-T3** Router l'appel entrant vers le bon `Client` via le numéro `To`.
- ☐ **P1-T4** Créer un enregistrement `Call` (appelant, horodatage, statut) pour chaque appel manqué.
- ☐ **P1-T5** Journaliser même si aucun SMS ne suit (le patron a au moins numéro + heure).

**Acceptation :** un appel manqué réel crée une ligne `Call` scopée au bon client.
**Hors-scope :** SMS, qualification.

---

## Phase 2 — Relance SMS automatique ★

**But :** envoyer le premier SMS et maintenir le fil.

- ☐ **P2-T1** Service d'envoi SMS (Twilio Messaging) avec nom de boîte + mention STOP.
- ☐ **P2-T2** Déclencher le SMS auto après un `Call` manqué (délai configurable, défaut 30 s).
- ☐ **P2-T3** Endpoint webhook SMS entrant (vérif. signature).
- ☐ **P2-T4** Créer/retrouver une `Conversation` par appelant + enregistrer chaque `Message`.
- ☐ **P2-T5** Gérer plusieurs SMS d'affilée du même appelant (regroupement).

**Acceptation :** appel manqué → SMS reçu par le client → sa réponse est stockée dans la bonne `Conversation`.
**Hors-scope :** intelligence de la réponse (phase 3).

---

## Phase 3 — Qualification ★

**But :** comprendre le besoin et savoir quand passer la main.

- ☐ **P3-T1** Client LLM (Claude Haiku 4.5) + system prompt + prompt caching.
- ☐ **P3-T2** Implémenter le **contrat de sortie JSON** de `techStack.md §5` (tool use / sortie structurée).
- ☐ **P3-T3** Boucle de conversation : réponse → `reply` renvoyé par SMS, qualif mise à jour.
- ☐ **P3-T4** Détection de complétude (`complete=true`) → créer/MAJ un `Lead`.
- ☐ **P3-T5** Handoff : `needs_human=true` ou > 6 tours → « je transmets, on vous rappelle » + flag.
- ☐ **P3-T6** Garde-fou anti-hors-sujet / spam.

**Acceptation :** une conversation typique produit un `Lead` qualifié (type, urgence, lieu, dispo, résumé) ; un cas tordu déclenche le handoff sans dire de bêtise.
**Hors-scope :** alertes, dashboard.

---

## Phase 4 — Alertes & récap quotidien ★

**But :** le patron est prévenu, et voit le ROI.

- ☐ **P4-T1** Alerte instantanée au patron (SMS et/ou email) à chaque `Lead` qualifié.
- ☐ **P4-T2** Job cron quotidien (worker) : email récap par client.
- ☐ **P4-T3** Contenu récap : appels captés du jour, leads, en attente de rappel.
- ☐ **P4-T4** Compteur mensuel ROI dans l'email : « X appels captés, Y leads ce mois ».

**Acceptation :** chaque soir, chaque client actif reçoit un récap exact ; chaque lead génère une alerte.
**Hors-scope :** UI web.

---

## Phase 5 — Config & garde-fous ★ (fin du MVP livrable)

**But :** rendre le service paramétrable et sûr pour un vrai client.

- ☐ **P5-T1** Liste blanche : numéros exclus → aucun SMS auto.
- ☐ **P5-T2** Opt-out STOP : réception → arrêt immédiat + marquage, respect permanent.
- ☐ **P5-T3** Horaires : message différent jour / hors-heures / week-end.
- ☐ **P5-T4** Gabarits de messages personnalisés par client (`MessageTemplate`).
- ☐ **P5-T5** Détection FR/NL basique.

**Acceptation :** un client peut être configuré de bout en bout sans toucher au code.

> ✅ **Fin de la Phase 5 = MVP prêt à déployer chez le premier client.**

---

## Phase 6 — Dashboard admin & début de gestion client (API-first)

**But :** visualisation + un premier socle de gestion de VOS clients (les PME), exposé via l'API v1 pour être repris par une app mobile.

- ☐ **P6-T1** Auth (admin + owner), jetons app-ready (cf. `techStack.md §8.5`).
- ☐ **P6-T2** Vue appels/leads + statuts (nouveau / à rappeler / traité).
- ☐ **P6-T3** Compteur ROI affiché.
- ☐ **P6-T4** Écran de config client (horaires, liste blanche, gabarits).
- ☐ **P6-T5** Liste de vos clients (PME) + fiche client, via `/api/v1/clients`.
- ☐ **P6-T6** Récap par client : activité (appels captés, leads, ROI) + journal des échanges.
- ☐ **P6-T7** Renommage d'un client (`displayName`).
- ☐ **P6-T8** Notes internes par client (`ClientNote`).
- ☐ **P6-T9** Envoi d'un message à un client (artisan) — SMS/email — journalisé (`ClientMessage`).

> Toutes les actions P6-T5 → P6-T9 passent par `/api/v1` (compatibles app mobile dès le départ).

---

## Phase 7 — Multi-tenant, onboarding & facturation

- ☐ **P7-T1** Durcir l'isolation multi-tenant (revue de toutes les requêtes scopées `clientId`).
- ☐ **P7-T2** Onboarding d'un nouveau client (provisioning numéro + config guidée).
- ☐ **P7-T3** Plans & facturation : base + numéro supplémentaire (+39 €) ; hook Stripe.
- ☐ **P7-T4** Politique de rétention/purge RGPD (ex. 12 mois).

---

## Phase 8 — Pilote & mise en production

- ☐ **P8-T1** Checklist go-live (signatures webhooks, monitoring, alertes erreurs).
- ☐ **P8-T2** Déploiement chez le 1er client pilote (setup offert).
- ☐ **P8-T3** Boucle de feedback + ajustements des gabarits/qualif.
- ☐ **P8-T4** Cas client / témoignage pour la vente.

---

## Modules hors-MVP (backlog priorisé, après go-live)

1. **Avis Google automatique** après intervention (facile, gros effet, vendable en module).
2. **Prise de RDV** (lien agenda, sync Google Calendar).
3. **Devis pré-rempli** + relances de devis (J+3 / J+7).
4. **Agent vocal** qui décroche (premium — le plus cher à exploiter).
5. WhatsApp, Messenger/Insta, transcription des messages vocaux.
6. Mini-CRM complet, routage intelligent, reporting avancé, multilingue complet, white-label.
