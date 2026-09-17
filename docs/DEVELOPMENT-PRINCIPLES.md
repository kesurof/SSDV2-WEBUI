# Principes de conception et de développement

> Règles permanentes du dépôt : elles s'appliquent à toute conception, tout choix technique
> et toute modification. Une exception durable ne s'improvise pas : elle se documente
> explicitement (ADR ou mise à jour du plan — voir principes §3 et §9).
>
> Contraintes spécifiques au projet (sources de vérité, interdits, sécurité, stack) :
> [`../AGENTS.md`](../AGENTS.md) et [brief](SSDV2_WEBUI_PROJECT_BRIEF.md) §62, §71, §75.
> Rappels opérationnels courts : [`../AGENTS.md`](../AGENTS.md).

## A. Auditer et choisir

### 1. Auditer avant de construire

Avant toute fonctionnalité importante :

- identifier les sources de vérité existantes ;
- comprendre le flux d'exécution réel ;
- rechercher les mécanismes, services, composants, helpers et abstractions déjà présents ;
- vérifier les dépendances déjà disponibles ;
- vérifier les tests et contraintes existants.

Ne pas réécrire une fonctionnalité simplement parce qu'elle est difficile à trouver. Ne pas
créer une deuxième implémentation avant d'avoir vérifié la première.

Dans ce projet : inspecter le mécanisme SSDV2 réel avant toute modification (brief §71
règle 1 ; [`../AGENTS.md`](../AGENTS.md) règle 10).

### 2. Minimiser le code maison

Avant de créer une fonctionnalité générique ou une abstraction technique, vérifier dans cet
ordre :

1. existe-t-elle déjà dans le dépôt ?
2. une abstraction existante peut-elle être étendue proprement ?
3. une dépendance déjà installée couvre-t-elle correctement le besoin ?
4. une brique externe mature et bien maintenue couvre-t-elle mieux le besoin ?
5. seulement ensuite, créer une implémentation interne.

Préférer une solution éprouvée lorsqu'elle réduit significativement le code à maintenir,
couvre correctement le besoin réel, apporte une API stable, possède un niveau de maintenance
satisfaisant, s'intègre naturellement à l'architecture et n'ajoute pas une complexité
disproportionnée.

Ne pas maintenir une abstraction maison importante lorsqu'une solution mature couvre
clairement mieux le même besoin. À l'inverse :

- ne pas ajouter une dépendance pour remplacer quelques lignes simples et stables ;
- ne pas ajouter une bibliothèque uniquement parce qu'elle est populaire ;
- ne pas ajouter une abstraction uniquement pour « préparer le futur » ;
- ne pas encapsuler une bibliothèque sans valeur ajoutée réelle.

L'objectif n'est pas « zéro code maison » mais le minimum de code spécifique nécessaire pour
exprimer la valeur métier propre au projet. Le code maison doit prioritairement porter : la
logique métier spécifique, les intégrations propres au projet, les contrats qui n'existent
pas ailleurs, les règles réellement différenciantes.

Dans ce projet, les besoins génériques sont couverts par les briques retenues (ADR-0004) :
shadcn/ui, TanStack Table, TanStack Query, React Hook Form, Zod, Sonner.

### 3. Toute nouvelle dépendance doit justifier sa complexité

Avant d'introduire une dépendance nouvelle, vérifier : besoin réel ; dépendances déjà
présentes ; quantité de code qu'elle remplace ; nombre d'usages concernés ; coût de
migration ; coût opérationnel ; impact sécurité ; impact performance ; impact bundle/runtime
lorsque pertinent ; maintenance ; pérennité ; risque de verrouillage ; intégration avec les
conventions du dépôt.

Pour une dépendance structurante, documenter la décision en ADR dans
[`DECISIONS.md`](DECISIONS.md). En cas de doute entre conserver l'existant, améliorer une
abstraction interne, créer une abstraction partagée ou adopter une bibliothèque externe :
présenter d'abord une comparaison synthétique.

Ne pas prendre silencieusement une décision architecturale importante.

## B. Construire dans le bon ordre

### 4. Préférer le moteur fonctionnel à l'interface

Pour une fonctionnalité comportant une logique métier ou système significative, prioriser :

besoin → contrat métier → moteur / service → tests → interface ou API → UI minimale →
validation fonctionnelle → enrichissement UX.

Ne pas laisser l'interface dicter prématurément le modèle métier. Le moteur doit pouvoir
être compris et testé indépendamment de son apparence visuelle lorsque c'est raisonnablement
possible.

### 5. Garder l'interface mince

L'interface ne doit pas devenir une seconde implémentation du moteur. La logique métier, les
validations d'autorité, les règles de sécurité et les opérations sensibles vivent dans la
couche moteur/service.

Le frontend peut gérer : état d'affichage, interactions, composition UI, validation
ergonomique, cache et orchestration client lorsque nécessaire.

Il ne doit pas être la seule autorité pour : permissions, règles métier, validation
critique, opérations destructrices, cohérence des données.

Dans ce projet, l'autorité est le backend, qui délègue à SSDV2 via `ssdv2ctl` (règles 4-6
d'[`../AGENTS.md`](../AGENTS.md)).

### 6. Valider avec une UI simple avant de polir

Lorsqu'une interface existe : commencer par les parcours fonctionnels essentiels, utiliser
en priorité des composants éprouvés, réutiliser les composants déjà présents, éviter les
animations et raffinements prématurés, ne créer un composant très personnalisé que lorsqu'un
besoin réel le justifie.

Ne pas recréer tableau, dialogue, toast, dropdown, formulaire, pagination, navigation ou
validation si une brique déjà retenue couvre correctement le besoin (shadcn/ui, TanStack
Table, TanStack Query, React Hook Form + Zod, Sonner — ADR-0004). Le polish vient après
validation du fonctionnement.

### 7. Petit écran utilisable, desktop enrichi

Ce projet est une console d'administration dense, prioritairement desktop (brief §15).
Toutefois, les parcours essentiels — consulter, démarrer/arrêter, lire les logs, confirmer
une action — doivent rester utilisables sur petit écran avant tout enrichissement desktop :
densité supplémentaire, colonnes complémentaires, raccourcis, actions avancées, panneaux
secondaires.

Mobile utilisable ne signifie pas limiter les capacités desktop : le desktop reste la cible
principale de densité et de vitesse.

### 8. Développer par vertical slices

Préférer moteur + contrat + tests + interface minimale + validation pour une fonctionnalité
complète, plutôt que construire toutes les couches techniques du projet avant d'obtenir un
flux fonctionnel. Chaque tranche doit vérifier une vraie capacité du système.

Éviter les longues phases où toute l'architecture est créée et de nombreuses abstractions
sont ajoutées, mais aucun parcours réel n'est fonctionnel (brief §71 règle 3).

### 9. Respecter le plan validé

Une fois une roadmap ou un workstream validé : suivre son ordre logique, ne pas élargir
silencieusement le périmètre, ne pas effectuer de refactorisation opportuniste sans rapport,
ne pas introduire une technologie supplémentaire sans nécessité.

Si une découverte remet le plan en cause :

1. documenter le constat ;
2. expliquer son impact ;
3. proposer l'ajustement minimal ;
4. mettre à jour le plan ou la décision ;
5. puis seulement implémenter.

Le code ne doit pas dériver silencieusement par rapport au plan documenté.

## C. Écrire du code durable

### 10. Une source de vérité par information

Ne pas recopier durablement une donnée simplement pour faciliter une couche secondaire. Si
un cache, une projection ou une vue dérivée est nécessaire, documenter clairement : sa
source, son mécanisme de rafraîchissement, son invalidation, sa possibilité de
reconstruction. Une donnée dérivée ne doit jamais devenir accidentellement une seconde
autorité.

Dans ce projet : SSDV2 reste la source de vérité, la SQLite WebUI ne stocke que ses données
propres et l'état applicatif est un `AppState` agrégé à la lecture (ADR-0002, brief §48).

### 11. Ne pas abstraire pour anticiper un futur hypothétique

Créer une abstraction uniquement lorsqu'elle supprime une duplication réelle, représente un
contrat stable, simplifie clairement la maintenance, améliore réellement les tests ou isole
une dépendance externe significative.

Ne pas créer une abstraction uniquement pour réduire le nombre de lignes ou de fichiers,
harmoniser artificiellement deux cas différents, ou préparer un hypothétique futur usage.

Préférer la duplication locale temporaire à une mauvaise abstraction globale lorsque le
contrat commun n'est pas encore clair.

### 12. Préférer la composition

Lorsque plusieurs fonctionnalités partagent une partie de comportement, préférer la
composition de petites briques explicites à un composant ou service générique rempli de
paramètres conditionnels. Éviter les abstractions dont l'API devient progressivement
optionnelle partout, dépendante du contexte ou difficile à comprendre sans lire son
implémentation.

### 13. Ne pas conserver deux solutions concurrentes

Après une migration complète vers une nouvelle abstraction, bibliothèque, service ou
contrat, supprimer l'ancienne solution lorsqu'elle n'a plus d'usage réel. Ne pas conserver
deux manières concurrentes d'accomplir la même tâche sans raison explicite.

## D. Sécurité, performance, observabilité

### 14. Sécurité et validation côté autorité

Les contrôles critiques sont réalisés dans la couche qui possède réellement l'autorité. Une
validation frontend améliore l'expérience utilisateur ; elle ne remplace jamais la
validation serveur, l'autorisation, les contrôles métier ni les protections sur les
opérations sensibles (règles 4-6 d'[`../AGENTS.md`](../AGENTS.md)).

### 15. Mesurer avant d'optimiser

Ne pas complexifier l'architecture pour une optimisation supposée. Avant une optimisation
significative : identifier le problème réel, obtenir une mesure, fixer un objectif, vérifier
que la solution améliore effectivement la situation.

Éviter les caches, workers, files de messages, bases supplémentaires ou mécanismes
distribués sans besoin démontré. L'image unique et l'absence de Redis/Celery sont des
contraintes du projet (ADR-0003).

### 16. Favoriser l'observabilité du moteur

Les opérations importantes doivent être suffisamment observables pour comprendre ce qui
s'est passé, ce qui a échoué, à quelle étape, avec quel contexte non sensible. Préférer des
erreurs structurées et des états explicites aux échecs silencieux.

L'observabilité est prioritaire sur le polish visuel lorsqu'une fonctionnalité n'est pas
encore fiable.

## E. Prouver et synchroniser

### 17. Exiger une preuve avant de déclarer une tâche terminée

Une tâche ne passe pas à `terminée` simplement parce que le code semble correct. Le critère
de réussite doit être vérifié par une preuve observable adaptée au changement : test
automatisé, commande ciblée, build réussi, comportement reproduit, vérification d'une API,
inspection d'un état, test d'intégration, contrôle manuel documenté lorsqu'aucune
automatisation raisonnable n'existe.

La preuve est consignée dans [`PROGRESS.md`](PROGRESS.md) lorsque la tâche est importante.
Si le critère de réussite n'a pas été vérifié, la tâche reste : à valider, partiellement
terminée, ou bloquée.

### 18. Code + tests + documentation = une seule modification

Une tâche n'est pas terminée si : le comportement a changé mais les tests ne le couvrent
plus ; la documentation décrit encore l'ancien comportement ; la roadmap ou le suivi affirme
un état incorrect ; une règle agent devenue fausse subsiste ; une décision durable n'est
documentée nulle part.

À la fin de toute modification significative, vérifier explicitement :

```text
CODE
TESTS
DOCUMENTATION
ROADMAP / PROGRESS
AGENTS.md si nécessaire
```

Ils doivent raconter la même réalité.

### 19. Garder `AGENTS.md` compact

Les principes ci-dessus vivent ici, pas dans [`../AGENTS.md`](../AGENTS.md). `AGENTS.md` ne
conserve que les rappels opérationnels spécifiques au dépôt qu'un futur agent risquerait
réellement de manquer.

Lorsqu'une règle détaillée possède déjà une source documentaire de référence : n'ajouter
qu'une référence courte si elle est réellement nécessaire ; ne pas dupliquer son contenu.
