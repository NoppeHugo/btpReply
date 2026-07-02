# agents.md — Cadre de travail des agents

> À lire **en entier au début de chaque session**, avant toute action.
> Ce fichier définit comment travailler sur ce repo. Il prime sur toute habitude par défaut.

---

## 1. Contexte produit (à connaître par cœur)

Service qui empêche une PME de perdre un client sur un appel manqué :
appel manqué → SMS auto au client → qualification par conversation → alerte au patron → récap quotidien.
Cibles : artisans/PME de la région de Mouscron + Eurométropole Lille-Kortrijk-Tournai.
Multi-tenant dès le départ. Équipe : 2 personnes (un technique, un commercial).

**Interdit absolu côté client final :** les mots « IA », « bot », « robot », « automatique » dans tout SMS envoyé à un appelant. Le service doit ressembler à un secrétariat humain.
**Exception légale (AI Act art. 50)** : le service ne prétend jamais être une personne physique, et si l'appelant demande explicitement s'il parle à un robot/une machine, il le confirme (« service de messages automatisé ») puis passe en handoff. Voir journal de décisions du 2026-07-02.

---

## 2. Documents de référence (ordre de lecture)

1. **`agents.md`** (ce fichier) — comment travailler.
2. **`techStack.md`** — quoi utiliser. **Aucune techno hors de cette liste.**
3. **`mvp.md`** — où on en est et quoi faire ensuite.
4. **`AICOSTS.md`** — règles d'optimisation du coût LLM (à lire avant tout code touchant au LLM).

En cas de contradiction : `techStack.md` fait foi pour la technique ; `mvp.md` fait foi pour le périmètre et l'ordre.

---

## 3. Savoir à tout moment où on en est (discipline d'état)

C'est une **obligation**, pas une option. L'agent ne « perd » jamais le fil parce que l'état est écrit, pas mémorisé.

### Au démarrage d'une session, l'agent DOIT :
1. Lire le bloc **« ÉTAT ACTUEL »** en haut de `mvp.md`.
2. Identifier la **prochaine tâche non cochée** (ex. `P2-T3`).
3. Annoncer en une phrase : phase en cours, tâche prise, ce qu'il va faire.

### À la fin de CHAQUE tâche, l'agent DOIT :
1. Cocher la case de la tâche dans `mvp.md` (`☐` → `☑`).
2. Mettre à jour le bloc **« ÉTAT ACTUEL »** (dernière tâche OK, prochaine tâche, date, bloqueurs).
3. Faire un commit qui référence l'ID de tâche (voir §6).
4. Si une décision technique a été prise → l'ajouter au **Journal des décisions** de `techStack.md`.

> Règle d'or : **si ce n'est pas écrit dans `mvp.md` / `techStack.md`, ça n'existe pas.** L'état vit dans les fichiers.

---

## 4. Règles dures (non négociables)

1. **Multi-tenant :** toute requête base est scopée par `clientId`. Aucune fuite cross-tenant. Une requête non scopée hors module admin = bug critique.
2. **Pas d'invention de stack :** aucune dépendance/service hors `techStack.md`. Besoin d'un nouvel outil → l'inscrire d'abord dans `techStack.md` avec justification, sinon stop et demander.
3. **Sécurité webhooks :** chaque endpoint Twilio vérifie la signature. Pas de webhook ouvert.
4. **Secrets :** uniquement via variables d'environnement (noms de `techStack.md §10`). Jamais de secret en dur, jamais commité.
5. **PII / RGPD :** jamais de contenu de SMS loggé en clair en prod. Hébergement/services en UE. Respecter STOP immédiatement.
6. **Vocabulaire client :** voir §1 — aucun terme « IA/bot/robot/automatique » côté appelant.
7. **LLM avec parcimonie :** ce qu'une règle déterministe peut faire (horaires, liste blanche, STOP) ne passe pas par le LLM. Plafond 6 tours puis handoff. **Respecter `AICOSTS.md`** (Haiku par défaut, prompt caching, sortie minimale, un seul appel par tour).
8. **TypeScript strict :** pas de `any` non justifié, pas de `@ts-ignore` sans commentaire explicatif.
9. **Pas de sur-ingénierie :** on n'ajoute pas Redis/queues/microservices tant que le besoin n'est pas réel (cf. `techStack.md §7`).
10. **Périmètre :** on n'implémente pas de fonctionnalité hors de la phase en cours. Une bonne idée → backlog de `mvp.md`, pas dans le code maintenant.
11. **API-first :** toute fonctionnalité de gestion (dont la gestion client) passe par l'API v1 (`/api/v1`, REST/JSON, auth par jeton). Aucune logique métier couplée à l'UI web ; le web et la future app mobile consomment la même API. Voir `techStack.md §8.5`.

---

## 5. Bonnes pratiques de code

- **Petits incréments :** une tâche `mvp.md` = une unité de travail = idéalement un commit/PR.
- **Logique métier dans `/lib`**, pas dans les composants UI ni les route handlers (qui restent fins).
- **Validation des entrées** (webhooks, formulaires) avec un schéma (ex. zod) à la frontière.
- **Gestion d'erreur explicite :** pas de `catch` vide ; erreurs typées, loggées via pino, remontées à Sentry.
- **Tests :** toute logique métier non triviale (qualification, routage tenant, horaires, STOP) a un test Vitest. Une tâche n'est « done » que si elle a au moins le test du chemin nominal.
- **Idempotence :** les handlers de webhook doivent tolérer les rejeux Twilio (mêmes events livrés 2×).
- **Nommage :** identifiants en anglais ; commentaires/prose en français acceptés.
- **Pas de TODO orphelin :** un TODO renvoie à un ID de tâche `mvp.md`.

---

## 6. Git & commits

- Branche par tâche : `feat/P2-T3-inbound-sms-webhook`.
- Commits conventionnels **référençant l'ID** : `feat(P2-T3): handle inbound SMS webhook`.
- Une PR par tâche (ou petit groupe cohérent), CI verte obligatoire avant merge.
- Le message de PR rappelle : tâche, critère d'acceptation atteint, test ajouté.

---

## 7. Définition de « terminé » (Definition of Done)

Une tâche est terminée quand **tout** est vrai :
- [ ] Le critère d'acceptation de la phase (dans `mvp.md`) est satisfait.
- [ ] Au moins un test couvre le chemin nominal.
- [ ] TypeScript strict passe, lint OK, CI verte.
- [ ] Requêtes scopées `clientId` (si applicable).
- [ ] Case cochée + bloc ÉTAT ACTUEL mis à jour dans `mvp.md`.
- [ ] Décision technique éventuelle ajoutée au journal de `techStack.md`.
- [ ] Commit référence l'ID de tâche.

---

## 8. Quand s'arrêter et demander (ne pas deviner)

L'agent **s'arrête et pose la question** si :
- une techno/dépendance non prévue semble nécessaire ;
- une règle dure (§4) entrerait en conflit avec la demande ;
- le contrat de sortie LLM ou le schéma de données devrait changer ;
- l'exigence est ambiguë sur le périmètre (quelle phase ?) ;
- une action toucherait des données réelles de clients en production.

Mieux vaut une question courte qu'une dérive silencieuse.

---

## 9. Checklist de démarrage de session (copier-coller mental)

1. Lire `agents.md` → `techStack.md` → bloc ÉTAT ACTUEL de `mvp.md`.
2. Annoncer phase + prochaine tâche.
3. Implémenter en respectant §4 et §5.
4. Tester.
5. Cocher + mettre à jour l'ÉTAT ACTUEL + journal de décisions si besoin.
6. Commit référencé + PR.
