# SMS — Pool de numéros « collants » (sticky sender)

> **But** : éliminer *déterministe­ment* la collision de routage des SMS entrants,
> sans passer à un numéro dédié par client.

## Contexte / problème

Aujourd'hui l'app utilise **un seul numéro partagé** (`SMSTOOLS_SENDER`) pour tous
les clients. Le routage des SMS entrants se fait **par le numéro de l'appelant**
(`findOpenConversationByCaller` → `smstools/inbound/route.ts`), car au moment où
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
simultanément. En pratique 3–5 numéros couvrent tous les cas réels.

### Bénéfice bonus

Le numéro destinataire redonne un contexte au message entrant → règle aussi
partiellement la limite « STOP reçu sans conversation ouverte ne peut pas être
rattaché à un client ».

## Impact technique (à implémenter)

1. **Prisma** : nouvelle table `SenderNumber` (le pool) + colonne
   `senderNumber` sur `Conversation`.
2. **Attribution** : à l'ouverture d'une conversation (`sendSms` / création de
   conversation), choisir un numéro du pool libre pour cet appelant, le stocker
   sur la conversation, et l'utiliser comme `sender`.
3. **Routage entrant** : dans `smstools/inbound`, router par
   `(senderNumber = message.receiver, callerNumber = message.sender)` au lieu de
   `sender` seul. Le webhook lit déjà `message.receiver`.
4. **Tests** : attribution (numéro libre choisi, réutilisation du même numéro pour
   une conversation existante), routage entrant sans ambiguïté.

## Pré-requis côté smstools (à vérifier)

- Pouvoir **louer plusieurs numéros virtuels**.
- Recevoir le champ `receiver` dans le webhook entrant `inbox_message`
  (déjà lu dans le payload actuel — OK).

## Alternatives écartées

| Option | Verdict |
|--------|---------|
| **Un numéro par client** | Élimine aussi, mais coût élevé + provisioning à chaque onboarding. Le pool donne le même résultat pour une fraction du coût. Reste l'évolution future si on veut du branding. |
| **Sender alphanumérique** (« Dupont ») | Brande + désambiguïse, mais un ID alphanumérique **ne peut pas recevoir de réponse** → casse le mode conversationnel. ❌ |
| **Interdire 2 conversations ouvertes par appelant** | Pénalise le 2ᵉ client (ne peut plus joindre l'appelant). ❌ |

## Reco

Implémenter le **pool de numéros collants** : élimination déterministe, coût
minime (3–5 numéros), archi propre et évolutive vers « un numéro par client » plus
tard si besoin de branding.
