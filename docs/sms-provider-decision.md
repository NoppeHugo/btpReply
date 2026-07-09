# Décision — Fournisseur SMS : retour sur Twilio

> **Statut : décidé & implémenté (juillet 2026).** Le SMS repasse de **smstools**
> à **Twilio**. La voix était déjà sur Twilio ; on repasse aussi le SMS dessus
> pour un fournisseur unique.

## TL;DR

**smstools facture ~30 €/mois par numéro belge bidirectionnel.** Twilio loue le
même type de numéro à **~1,25 $/mois**. Sur notre profil (numéro mono/pool de
1–2 numéros partagés, volume modéré au lancement), Twilio est **moins cher au
total**, **à prix fixe et prévisible**, et **mono-fournisseur** (voix déjà chez
Twilio). On repasse donc sur Twilio.

## Contexte

L'app avait migré Twilio → smstools pour le SMS (per-SMS ~0,06 € vs ~0,10 €).
Mais smstools loue ses numéros belges **capables de recevoir** (two-way) à
**~30 €/mois pièce** — coût découvert après la migration. Comme notre archi
[[sms-sender-pool]] repose sur un **pool de numéros**, ce coût fixe se multiplie
et pèse bien plus que l'économie au SMS.

## Comparatif (Belgique, SMS bidirectionnel)

| Fournisseur | Numéro two-way BE /mois | €/SMS → mobile BE | Two-way BE | Note |
|---|---|---|---|---|
| **Twilio** ✅ | **~1,25 $** | ~0,096–0,11 € (**fixe**) | oui | déjà utilisé pour la voix |
| Telnyx | ~1,10 $ (1 $ + 0,10 $ SMS) | non public (sur devis) | oui | numéro le moins cher, mais nouveau fournisseur |
| Plivo | ~0,50–1 $ | 0,043 $ (Orange) → **0,131 $ (Proximus)** | oui | ⚠️ prix selon l'opérateur du destinataire |
| Vonage | bas (~1 €) | 0,097 € | oui | rien de distinctif |
| Spryng | sur devis | 0,06 € | à confirmer | Benelux, tarif numéro non public |
| **smstools** ❌ | **30 €** | 0,06 € | oui | numéro hors de prix |

Sources : pages tarifaires Twilio/Telnyx/Plivo Belgique + comparatif Sweego
(consultées 07/2026).

## Analyse coût

- **Numéro** : Twilio ~1,25 $/mois écrase smstools (30 €). Écart ~28,75 €/mois
  par numéro.
- **Par SMS** : Twilio ~0,10 € vs smstools 0,06 € → +0,04 €/SMS.
- **Point de bascule** : ~720 SMS/mois **sur un même numéro** avant que le
  per-SMS de smstools ne rattrape la location. Comme le pool partage 1–2 numéros
  entre tous les clients, le coût fixe reste bas ; le total Twilio reste inférieur
  **jusqu'à ~1 400–1 500 SMS/mois** à l'échelle plateforme.

Scénarios :

| Scénario | Twilio | smstools |
|---|---|---|
| 1 artisan, ~250 SMS/mois | ~26 € | ~45 € |
| Plateforme, 2 numéros, 2 000 SMS/mois | ~202 € | ~180 € |

→ Twilio gagne au lancement ; smstools ne repasse devant qu'à **fort volume**
avec un pool volontairement minuscule.

## Pourquoi Twilio (et pas Telnyx, le moins cher sur le papier)

Telnyx a le numéro le plus bas (~1,10 $) mais l'écart réel avec Twilio est
**dérisoire** (~0,15 €/mois, quelques centimes/SMS). Le décisif :

1. **Mono-fournisseur** — la voix est déjà sur Twilio (SDK `twilio` déjà présent,
   webhook signé, une facture, un support). Ajouter Telnyx = 2ᵉ compte, 2ᵉ KYC,
   2ᵉ intégration, 2ᵉ bundle réglementaire belge.
2. **Prix fixe** — Twilio facture le SMS BE au tarif fixe quel que soit
   l'opérateur, contrairement à Plivo (jusqu'à 0,131 $ sur Proximus, 1ᵉʳ opérateur
   belge → coût imprévisible).
3. **Pool quasi gratuit** — à ~1,15 €/numéro, ajouter des numéros au pool
   [[sms-sender-pool]] ne coûte presque rien ; l'option « un numéro par client »
   (branding) redevient même envisageable.

On repassera à smstools **ou** on négociera des tarifs volume **plus tard**, si on
dépasse durablement ~1 500 SMS/mois.

## Impact technique

L'archi (pool de numéros collants + cooldown + file d'attente entrante) est
**indépendante du fournisseur** et ne change pas. Seul le transport bascule :

1. **Envoi** : `sendSms` (`src/lib/sms/service.ts`) appelle désormais
   `twilioSmsSend` (`src/lib/twilio/sms.ts`, REST `messages.create`) au lieu de
   `smstoolsSend`. Nécessite `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`.
2. **Entrant** : nouveau webhook `POST /api/v1/webhooks/twilio/sms`
   (`src/app/api/v1/webhooks/twilio/sms/route.ts`), **signé** via
   `X-Twilio-Signature` (`validateTwilioSignature`, déjà utilisé par la voix) —
   plus sûr que le token en query de smstools. Il lit `From` (appelant), `To`
   (notre numéro = clé de routage du pool), `Body`, `MessageSid` (idempotence) et
   met en file via `enqueueInboundSms`.
3. **Numéros du pool** : `TWILIO_SENDERS` (liste séparée par virgules) ou table
   `SenderNumber`. `TWILIO_SENDER` = numéro unique par défaut.
4. **Supprimé** : `src/lib/smstools/client.ts` et le webhook
   `src/app/api/v1/webhooks/smstools/inbound/route.ts`.

### Variables d'environnement

| Avant (smstools) | Après (Twilio) |
|---|---|
| `SMSTOOLS_CLIENT_ID` / `SMSTOOLS_CLIENT_SECRET` | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` |
| `SMSTOOLS_SENDER` / `SMSTOOLS_SENDERS` | `TWILIO_SENDER` / `TWILIO_SENDERS` |
| `SMSTOOLS_WEBHOOK_SECRET` (token query) | `TWILIO_WEBHOOK_SIGNING_KEY` (signature, déjà là pour la voix) |

## À faire côté Twilio (déploiement)

- Acheter un (ou plusieurs) **numéro(s) mobile belge(s) SMS-enabled** — bundle
  réglementaire belge à remplir (preuve d'identité/adresse d'entreprise, délai
  quelques jours).
- Configurer, sur chaque numéro, le webhook **« A message comes in »** →
  `https://<domaine>/api/v1/webhooks/twilio/sms` (POST).
- Renseigner `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SENDER`
  (+ `TWILIO_SENDERS` si pool) et vérifier `TWILIO_WEBHOOK_SIGNING_KEY`.

⚠️ **Opt-out Twilio** : si les numéros sont rattachés à un *Messaging Service*
avec « Advanced Opt-Out », Twilio peut intercepter « STOP » et répondre à notre
place. Notre gestion STOP est applicative → garder les numéros **hors** Messaging
Service Advanced Opt-Out, ou désactiver cette option, pour que le `STOP` atteigne
notre webhook.

## Alternatives écartées

| Option | Verdict |
|---|---|
| **Rester sur smstools** | Numéro à 30 €/mois × pool = trop cher au lancement. ❌ |
| **Telnyx** | Le moins cher sur le papier, mais nouveau fournisseur pour un gain négligeable ; per-SMS BE non public. ❌ (à revoir à fort volume) |
| **Plivo** | Prix/SMS dépendant de l'opérateur (jusqu'à 0,131 $ sur Proximus) → imprévisible. ❌ |
