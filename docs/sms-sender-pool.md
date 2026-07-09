# SMS — Pool de numéros « collants » (sticky sender)

> **But** : éliminer *déterministe­ment* la collision de routage des SMS entrants,
> sans passer à un numéro dédié par client.
>
> **Statut : implémenté.** Attribution + cooldown : `src/lib/sms/sender-pool.ts`.
> Assignation à la création du fil et routage entrant : `src/lib/conversations/service.ts`
> (`getOrCreateConversation`, `findOpenConversationForInbound`). Schéma : modèle
> `SenderNumber` + `Conversation.senderNumber` / `Conversation.lastMessageAt`.
> Config : `TWILIO_SENDERS` (pool) et `SENDER_COOLDOWN_DAYS` (défaut 7).
> Fournisseur SMS : **Twilio** (voir [sms-provider-decision.md](./sms-provider-decision.md)).

## Contexte / problème

Sans pool, l'app utilise **un seul numéro partagé** (`TWILIO_SENDER`) pour tous
les clients. Le routage des SMS entrants se ferait **par le numéro de l'appelant**
(`findOpenConversationByCaller` → `twilio/sms/route.ts`), car au moment où
un SMS arrive on ne sait pas *à qui* il répond : tous les clients partagent le
même expéditeur.

```ts
// conversations/service.ts — findOpenConversationByCaller
db.conversation.findFirst({
  where: {
    callerNumber,                    // ← filtre UNIQUEMENT sur qui écrit
    state: { in: ["open", "qualified"] },
  },
  orderBy: { createdAt: "desc" },    // ← la plus récente gagne
});
```

**La collision** : si le *même* appelant a deux conversations ouvertes
simultanément avec deux clients différents (ex. un particulier qui rate un appel
chez Plombier Dupont **et** chez Électricien Martin dans la même fenêtre), son SMS
entrant ne contient que `sender` + `content`. Impossible de savoir à quel client
il répond → le `findFirst … orderBy createdAt desc` attribue **mécaniquement** la
réponse à la conversation la plus récente, parfois à tort.

Rare (il faut la même personne active chez 2 clients en même temps) mais possible.

## Solution retenue : pool de numéros collants

Au lieu d'un seul numéro partagé, louer un **petit pool** de numéros virtuels
(2 à 5 suffisent). Règle d'attribution à l'ouverture d'une conversation :

> Quand on démarre une conversation avec l'appelant **C** pour le client **X**,
> choisir dans le pool un numéro qui n'a **aucune autre conversation ouverte avec
> ce même appelant C**.

Ainsi un appelant donné n'a jamais deux conversations ouvertes sur le **même**
numéro. Le SMS entrant devient identifiable de façon **déterministe** par le
couple `(numéro destinataire = receiver, appelant = sender)`.

### Exemple

| Jour   | Appelant | Client   | Numéro assigné |
|--------|----------|----------|----------------|
| Lundi  | Marc     | Dupont   | #1             |
| Mardi  | Marc     | Martin   | #2 (car #1 déjà pris pour Marc) |

Marc répond → le SMS arrive sur #1 **ou** #2 → on sait exactement à qui. ✅

### Garantie

L'élimination est **garantie** (pas juste probable) tant que la taille du pool ≥
au nombre max de clients qu'un *même* appelant peut avoir en conversation active
simultanément **dans la fenêtre de cooldown** (voir ci-dessous). Avec le cooldown,
1–2 numéros suffisent en pratique.

### Raffinement clé : cooldown / fenêtre d'activité

La collision n'existe que **pendant la fenêtre où deux conversations du même
appelant sont actives en même temps**. Or une conversation `qualified` **reste
dans cet état indéfiniment** (aucune transition automatique avec le temps) — donc
si on se base sur l'état brut, un numéro resterait bloqué pour toujours.

Il faut **découpler deux notions** :

| Question | Critère |
|----------|---------|
| Ce **lead** est-il encore pertinent ? | l'état métier (`qualified` = lead chaud, gardé tel quel pour le dashboard) |
| Ce **numéro** est-il encore réservé à cet appelant ? | l'**activité récente** (dernier message < N jours) |

La règle d'attribution devient donc :

> Un numéro est « occupé » pour l'appelant **C** seulement s'il a une conversation
> avec un **dernier message il y a moins de N jours** (cooldown, ex. **7 jours**).

Concrètement, la requête de sélection filtre sur `lastMessageAt > now - N jours`
au lieu de (ou en plus de) l'état. Après N jours sans échange, le numéro se
**libère tout seul**, **sans toucher à l'état** de la conversation — le lead
qualifié reste qualifié dans le dashboard.

**Effet sur l'exemple** :

| Scénario | Résultat |
|----------|----------|
| Marc appelle Dupont lundi, puis Martin **le lendemain** | chevauchement dans la fenêtre → **2 numéros** nécessaires |
| Marc appelle Dupont, puis Martin **une semaine+ après** | conv Dupont hors fenêtre → Marc reprend le **#1** → **1 seul numéro** suffit |

Résultat global : le pool ne doit couvrir que les appelants qui contactent
**plusieurs artisans dans la même fenêtre de N jours** — cas rare. On tourne avec
**1 à 2 numéros** + cooldown, au lieu de 3–5.

> **Pré-requis** : disposer d'un horodatage d'activité par conversation. Le modèle
> a déjà `updatedAt` (auto), mais il bouge à chaque update de la ligne (état,
> `turnCount`…). Le plus fiable est d'ajouter un champ dédié `lastMessageAt`, mis à
> jour à chaque message entrant/sortant.

### Fallback si le pool est épuisé

Si *tous* les numéros du pool sont déjà occupés pour cet appelant dans la fenêtre
(cas très rare : le même particulier en conversation active avec autant d'artisans
que de numéros), on **ne bloque pas l'envoi** : on **réutilise quand même un
numéro déjà pris** — idéalement le plus « ancien » (`lastMessageAt` le plus
lointain, donc le moins susceptible de recevoir une réponse bientôt). On accepte
alors le risque de collision résiduel pour ce cas limite, plutôt que de rater un
SMS. C'est un retour au comportement actuel, mais confiné à un scénario
exceptionnel au lieu d'être le cas général.

Stratégie de sélection, dans l'ordre :

1. Un numéro **totalement libre** pour cet appelant dans la fenêtre → idéal.
2. Sinon, le numéro **le moins récemment actif** avec cet appelant → fallback,
   collision improbable.

### Bénéfice bonus

Le numéro destinataire redonne un contexte au message entrant → règle aussi
partiellement la limite « STOP reçu sans conversation ouverte ne peut pas être
rattaché à un client ».

## Impact technique (à implémenter)

1. **Prisma** : nouvelle table `SenderNumber` (le pool) + colonnes `senderNumber`
   et `lastMessageAt` sur `Conversation`.
2. **Attribution** : à l'ouverture d'une conversation (`sendSms` / création de
   conversation), choisir un numéro du pool **libre pour cet appelant dans la
   fenêtre de cooldown** (aucune autre conversation avec `callerNumber = C` et
   `lastMessageAt > now - N jours` sur ce numéro), le stocker sur la conversation,
   et l'utiliser comme `sender`.
3. **Cooldown** : `lastMessageAt` mis à jour à chaque message entrant/sortant.
   Durée N configurable (env, ex. `SENDER_COOLDOWN_DAYS=7`).
4. **Routage entrant** : dans `twilio/sms`, router par
   `(senderNumber = To, callerNumber = From)` au lieu de `From` seul. Le webhook
   Twilio fournit `To` (notre numéro destinataire).
5. **Tests** : attribution (numéro libre choisi ; réutilisation du même numéro
   pour une conversation existante ; numéro repris après expiration du cooldown ;
   2ᵉ numéro pris si chevauchement dans la fenêtre), routage entrant sans
   ambiguïté.

## Pré-requis côté Twilio

- **Louer plusieurs numéros** SMS-enabled (~1,15 €/mois pièce — voir
  [sms-provider-decision.md](./sms-provider-decision.md)).
- Le champ `To` du webhook entrant Twilio donne notre numéro destinataire
  (clé de routage) — disponible nativement.

## Alternatives écartées

| Option | Verdict |
|--------|---------|
| **Un numéro par client** | Élimine aussi, mais coût élevé + provisioning à chaque onboarding. Le pool donne le même résultat pour une fraction du coût. Reste l'évolution future si on veut du branding. |
| **Sender alphanumérique** (« Dupont ») | Brande + désambiguïse, mais un ID alphanumérique **ne peut pas recevoir de réponse** → casse le mode conversationnel. ❌ |
| **Interdire 2 conversations ouvertes par appelant** | Pénalise le 2ᵉ client (ne peut plus joindre l'appelant). ❌ |

## Reco

Implémenter le **pool de numéros collants + cooldown d'activité** :

- **Cooldown** (ex. 7 j) : un numéro se libère tout seul après N jours sans
  échange → 1–2 numéros suffisent en pratique.
- **Fallback** : si le pool est épuisé pour un appelant, on réutilise le numéro le
  moins récemment actif plutôt que de rater le SMS → jamais bloquant.
- Élimination de la collision dans ~tous les cas réels, coût minime, archi propre
  et évolutive vers « un numéro par client » plus tard si besoin de branding.
