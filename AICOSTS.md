# AICOSTS.md — Maîtrise des coûts de tokens IA

> Règles d'optimisation du coût LLM, spécifiques à ce projet (qualification SMS en volume sur Claude Haiku 4.5).
> Complète `techStack.md §5` (choix LLM) et la règle dure n°7 de `agents.md` (LLM avec parcimonie).
> Un agent qui touche au code LLM lit ce fichier **avant**.

---

## Principe directeur

**Le LLM n'est pas cher ici — le gaspillage l'est.** À tarif de base, une conversation de qualif coûte
une fraction de centime. Ce qui fait exploser la facture, ce n'est jamais le prix du token, c'est
l'**architecture** : un mauvais modèle par défaut, des prompts non cachés, des boucles d'appels inutiles.
Bien fait, le LLM représente ~0,30–0,50 $ par client/mois (le coût dominant reste les SMS). Mal fait,
on multiplie ça par 10 à 50. Tout ce fichier sert à rester dans le « bien fait ».

**Objectif chiffré :** garder le coût LLM **sous ~1–2 €/client/mois** (cf. économie unitaire du business model).

---

## Les 5 leviers (par ordre d'impact)

1. **Bon modèle** (Haiku par défaut) — un mauvais modèle coûte 3 à 25× plus cher.
2. **Prompt caching** — jusqu'à **−90 %** sur la partie statique de l'input.
3. **Sortie minimale** — l'output coûte **5×** l'input ; c'est le poste le plus cher par token.
4. **Déterministe avant LLM** — chaque appel évité = **−100 %**.
5. **Batch API** pour le hors temps réel — **−50 %**.

---

## Tarifs de référence (à jour, USD / million de tokens)

| Élément | Input | Output |
|---|---|---|
| **Haiku 4.5** (modèle par défaut) | 1,00 $ | 5,00 $ |
| Haiku — lecture de cache (cache hit) | 0,10 $ (10 % de l'input) | — |
| Haiku — écriture de cache 5 min / 1 h | 1,25 $ / 2,00 $ | — |
| Haiku — **Batch API** (−50 %) | 0,50 $ | 2,50 $ |
| Sonnet 4.6 (à éviter sauf besoin justifié) | 3,00 $ | 15,00 $ |

Règle : **l'output est 5× le prix de l'input.** Économiser 100 tokens de sortie vaut économiser 500 tokens d'entrée.

---

## 1. Le bon modèle (routage)

- **Défaut = `claude-haiku-4-5`** pour toute la qualification/extraction. Suffisant et le moins cher.
- Ne passer à **Sonnet** que sur un cas **mesuré** où Haiku échoue (qualité de résumé, ambiguïté forte) — et le justifier dans le journal de `techStack.md`.
- **Jamais Opus** dans le chemin chaud.
- Ne pas « surclasser par confort ». Un agent qui choisit Sonnet « pour être sûr » coûte 3× sans gain mesuré.

---

## 2. Prompt caching (le plus gros levier après le modèle)

La structure du prompt doit séparer **statique** (caché) et **volatil** (non caché) :

```
[ CACHÉ — préfixe stable ]
  - system prompt (instructions, ton, règles)
  - définition de l'outil / schéma JSON de sortie
  - profil de la PME (nom, métier, services, zone)
  - exemples few-shot
[ NON CACHÉ — suffixe volatil ]
  - l'historique de la conversation SMS (court, qui grandit)
```

Règles :
- Mettre **tout le stable au début**, le point de césure du cache après le profil + few-shot.
- Le préfixe caché doit être **identique au byte près** entre les appels : aucune date, ID, horodatage ou variable dans la zone cachée (ça casse le cache et fait re-payer l'écriture).
- **TTL :** 5 min suffit entre les tours d'une même conversation (les SMS s'enchaînent en minutes). Pour un tenant à fort volume, le cache reste « chaud » et amortit l'écriture sur de nombreuses conversations.
- Le coût d'écriture du préfixe (~2 k tokens → ~0,004 $) est négligeable et se rentabilise dès la **première relecture**.
- **Cacher aussi la définition de l'outil/schéma** : elle compte en input à chaque appel sinon.

---

## 3. Minimiser la sortie (output = 5× l'input)

- **JSON compact**, strictement le contrat de `techStack.md §5`. Rien en plus, aucun texte hors JSON.
- `reply` est un **SMS** → court par nature. Imposer une longueur max dans le prompt.
- **Pas de chain-of-thought** dans la sortie pour une extraction simple. **Désactiver l'extended thinking** sur ce chemin : Haiku n'en a pas besoin ici et ça facture des tokens de sortie.
- Fixer un **`max_tokens` bas** (ex. 300) — garde-fou contre une sortie qui s'emballe.
- Ne jamais demander au modèle de **réécrire/recopier** l'historique ou le contexte en sortie.

---

## 4. Minimiser l'entrée

- **System prompt serré** : pas de paragraphes décoratifs, pas de redites. Chaque phrase gagne sa place.
- **Historique borné** : on n'envoie que la conversation en cours (déjà courte, plafonnée à 6 tours). Ne jamais réinjecter d'historique inutile ou d'autres conversations.
- **Pas de contexte « au cas où »** : n'envoyer que ce dont le tour a besoin.
- Few-shot : utile pour la qualité, mais le placer dans la **zone cachée** pour qu'il soit quasi gratuit après le 1er appel ; élaguer les exemples qui n'améliorent pas mesurablement.

---

## 5. Déterministe avant LLM (chaque appel évité = 100 % économisé)

Ne **jamais** appeler le LLM pour ce qu'une règle simple fait :
- détection **STOP** (opt-out) ;
- **liste blanche** (numéro exclu) ;
- **horaires** (jour / hors-heures / week-end) ;
- détection de **langue** basique (heuristique avant tout appel) ;
- filtrage **spam / message vide / non-pertinent** évident ;
- déduplication des webhooks Twilio rejoués.

Ces filtres tournent **en amont** ; le LLM n'est sollicité que si le message mérite une vraie qualification.

---

## 6. Un seul appel par tour

- La génération de la `reply` + l'extraction de qualif + la détection de complétude tiennent dans **un seul appel structuré** (c'est déjà le contrat). Ne pas les éclater en plusieurs appels.
- **Pas de boucle agentique** ni d'appels « de planification » pour ce produit simple. Un tour SMS = un appel LLM, point.
- Pas d'appel de **résumé séparé** : le `summary` fait déjà partie de la sortie structurée.

---

## 7. Batch API pour le hors temps réel (−50 %)

Le SMS en direct ne peut pas être batché (latence). Mais tout ce qui est **asynchrone** doit l'être :
- enrichissement / re-catégorisation nocturne de leads ;
- évaluations et tests de prompts (régressions) ;
- toute analyse de masse non urgente.

Le **récap quotidien** doit d'abord s'appuyer sur de l'**agrégation déterministe** (compter appels/leads en base). Si une formulation par LLM est ajoutée, elle passe par le **Batch API**.

---

## 8. Plafonds & garde-fous

- **6 tours max** par conversation (déjà une règle produit) = aussi un plafond de coût.
- **`max_tokens`** strict sur chaque appel.
- **Plafond de dépense par conversation et par tenant** + **alerte budget** : une conversation anormalement longue ou en boucle est coupée et flaggée (coût + signal de bug/abus).
- Boucle détectée (mêmes messages qui se répètent) → handoff humain, pas de relance LLM.

---

## 9. Mesure & observabilité (sans ça, on optimise à l'aveugle)

- Logger l'objet **`usage`** de chaque appel : `input`, `cached_input`, `output`.
- Agréger en **coût par lead** et **coût par client/mois** → c'est le COGS LLM réel par tenant.
- **Alertes** si le coût/lead ou le coût/tenant dépasse un seuil.
- Suivre le **taux de cache hit** : s'il chute, c'est que le préfixe n'est plus stable (régression à corriger).

---

## 10. Modèle de coût indicatif (pour fixer les attentes)

Estimation par conversation (Haiku, caching actif, ordres de grandeur) :

| Poste | Volume | Coût |
|---|---|---|
| Lecture du préfixe caché (~2 k tok) | par tour | ~0,0002 $ |
| Nouvel input non caché (~300 tok) | par tour | ~0,0003 $ |
| Output JSON (~150 tok) | par tour | ~0,00075 $ |
| **Total par tour** | | **~0,00125 $** |
| **Conversation (≈6 tours)** | | **~0,0075 $** |
| **50 conversations / client / mois** | | **~0,30–0,50 $** |

> Conclusion : à ce niveau, le LLM est quasi gratuit par rapport aux SMS. Le seul risque réel,
> c'est de casser cette structure (Sonnet par défaut, prompts non cachés, boucles d'appels) et de
> multiplier ce chiffre par 10–50. La discipline de ce fichier sert précisément à l'éviter.

---

## 11. Checklist avant de merger un changement touchant au LLM

- [ ] Modèle = Haiku 4.5 (tout passage à Sonnet est justifié + journalisé).
- [ ] Le préfixe caché est resté **stable** (rien de dynamique dedans) ; le cache hit ne régresse pas.
- [ ] La sortie est **uniquement** le JSON du contrat ; `max_tokens` est fixé ; pas d'extended thinking.
- [ ] Aucun nouveau filtre déterministe n'a été remplacé par un appel LLM.
- [ ] Pas d'appel LLM supplémentaire introduit dans le tour (toujours 1 appel/tour).
- [ ] L'`usage` est loggé et le coût/lead reste sous l'objectif.

---

## Anti-patterns (à ne JAMAIS faire)

- ❌ Choisir Sonnet/Opus « pour être sûr ».
- ❌ Mettre une date/un ID dans la zone cachée du prompt (casse le cache).
- ❌ Demander au modèle d'expliquer son raisonnement en sortie pour une simple extraction.
- ❌ Faire un appel LLM pour détecter STOP, les horaires ou la liste blanche.
- ❌ Multiplier les appels (planification, résumé séparé, re-vérification) sur un tour.
- ❌ Renvoyer tout l'historique ou du contexte superflu à chaque tour.
- ❌ Batcher des appels en temps réel, ou au contraire laisser les tâches offline en plein tarif.
