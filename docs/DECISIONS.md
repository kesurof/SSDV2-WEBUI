# Décisions architecturales (ADR)

Journal des décisions durables du projet. Le détail et la justification complète restent
dans la [spécification](SSDV2_WEBUI_PROJECT_BRIEF.md), section citée par chaque ADR.

## Quand créer un ADR

- changement de source de vérité ;
- choix ou remplacement d'un framework structurant ;
- ajout d'une dépendance majeure ;
- remplacement d'une abstraction interne importante ;
- séparation ou fusion de composants runtime ;
- changement durable du modèle client/serveur.

## Format

`Contexte` / `Décision` / `Conséquences` / `Alternatives écartées` / `Statut` / `Date` /
`Références`. Un ADR accepté n'est plus modifié (hors statut) ; une décision remplacée
pointe vers son remplaçant. Une décision non tranchée reste dans « Décisions ouvertes ».

## ADR-0001 — Ne pas réutiliser l'ancienne WebUI SSDV2

- **Statut** : acceptée — 2026-09-17
- **Contexte** : SSDV2 possède une WebUI existante (`ssd-frontend`, `ssd-backend`,
  `saison-frontend`) dont le code et l'architecture sont considérés comme une impasse.
- **Décision** : aucun code, aucune architecture, aucune dépendance fonctionnelle de
  l'ancienne WebUI n'est repris ; la nouvelle WebUI est un projet indépendant.
- **Conséquences** : reconstruction complète ; l'ancienne WebUI n'est qu'une source
  fonctionnelle d'information.
- **Alternatives écartées** : réutilisation ou refonte incrémentale de l'ancienne base.
- **Références** : brief §2, §62, §71 (règle 2).

## ADR-0002 — SSDV2 reste la source de vérité ; SQLite WebUI limitée à ses données propres

- **Statut** : acceptée — 2026-09-17
- **Contexte** : SSDV2 expose déjà catalogue, base `ssddb`, label Docker `ssdv2.app`,
  registres `<app>.containers|.volumes|.dns` et `account.yml`.
- **Décision** : la WebUI ne duplique aucun de ces états ; sa SQLite ne stocke que ses
  données propres (users, sessions, jobs, job_events, notifications, audit_events,
  webui_settings, favorites). L'état applicatif est un `AppState` agrégé à la lecture.
- **Conséquences** : pas de seconde base de vérité ni de synchronisation à maintenir ;
  l'état affiché dépend de la disponibilité de Docker/SSDV2 (mode dégradé obligatoire).
- **Alternatives écartées** : recopier l'état des applications dans SQLite ; considérer la
  WebUI comme propriétaire du catalogue.
- **Références** : brief §4-§7, §45, §48, §71 (règles 8-9).

## ADR-0003 — Une seule image Docker, un seul conteneur

- **Statut** : acceptée — 2026-09-17
- **Contexte** : volume attendu (~190 applications, un opérateur) et volonté d'éviter
  toute infrastructure inutile.
- **Décision** : une image multi-stage (build Node puis runtime Python) ; aucun Redis,
  Celery, PostgreSQL, serveur Node en production ni microservice.
- **Conséquences** : queue de jobs en mémoire + état SQLite, un seul worker de mutation ;
  pas de scalabilité horizontale (non nécessaire au besoin).
- **Alternatives écartées** : microservices frontend/backend/worker ; Redis + Celery ;
  PostgreSQL.
- **Références** : brief §11, §28, §54, §62, §71 (règle 10).

## ADR-0004 — Stack imposée

- **Statut** : acceptée — 2026-09-17
- **Contexte** : besoin d'un développement rapide assisté par agents et d'une UI admin
  dense, avec peu d'infrastructure.
- **Décision** : frontend React, TypeScript, Vite, shadcn/ui, Tailwind, TanStack
  Table/Query, React Router, React Hook Form, Zod, Sonner, Lucide ; backend Python 3.13,
  FastAPI, Pydantic, Docker SDK, SQLite, SQLAlchemy 2, SSE, pytest ; tests frontend
  Vitest + React Testing Library.
- **Conséquences** : les types frontend sont générés depuis l'OpenAPI FastAPI ; les
  composants shadcn existants doivent être réutilisés au lieu d'être réécrits.
- **Alternatives écartées** : frontend Jinja/HTMX ; autres frameworks et dépendances non
  listées sans ADR.
- **Références** : brief §14, §58-§59, §62, §75.

## ADR-0005 — `ssdv2ctl` comme frontière non interactive avec SSDV2

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la logique métier SSDV2 est portée par des dizaines de fonctions Bash
  interactives que la WebUI ne doit pas coupler directement.
- **Décision** : créer dans le cœur SSDV2 une interface `ssdv2ctl` non interactive, à
  sortie JSON, à commandes allowlistées, sans commande shell arbitraire ; la WebUI ne
  l'appelle que via un adaptateur dédié.
- **Conséquences** : prérequis de la Phase 0 ; le format d'implémentation reste à trancher
  (voir Décisions ouvertes).
- **Alternatives écartées** : appeler les fonctions Bash interactives depuis FastAPI ;
  réimplémenter la logique SSDV2 côté WebUI.
- **Références** : brief §9, §63 (Phase 0), §71 (règle 1).

## ADR-0006 — Opérations hôte hors MVP

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la WebUI s'exécute dans un conteneur et n'est pas l'hôte ; certaines
  opérations (UFW, iptables, apt, systemd, `/etc`, kernel, users) ne peuvent pas être
  exécutées naïvement depuis le conteneur.
- **Décision** : ces opérations restent dans la CLI SSDV2 au MVP ; pas de `--privileged`,
  `/:/host` ni `nsenter` sans décision architecturale explicite.
- **Conséquences** : certaines fonctions seront absentes de la WebUI ; une évolution
  éventuelle passerait par un agent hôte sécurisé (hors MVP).
- **Alternatives écartées** : conteneur privilégié ; montage de l'hôte ; `nsenter` dès le
  MVP.
- **Références** : brief §10, §62.

## ADR-0007 — Jobs : worker unique, file en mémoire, état SQLite, SSE

- **Statut** : acceptée — 2026-09-17
- **Contexte** : SSDV2 modifie des ressources globales (Docker, `account.yml`, DNS,
  registres, fichiers de configuration) ; les opérations longues ne doivent ni bloquer les
  requêtes HTTP ni se marcher dessus.
- **Décision** : chaque opération longue devient un job ; un seul worker de mutation, file
  en mémoire, état `jobs`/`job_events` en SQLite, progression en SSE ; au démarrage, les
  jobs `running` repassent à `interrupted`.
- **Conséquences** : pas de mutations parallèles au MVP ; toute action longue expose un
  `job_id` et des événements.
- **Alternatives écartées** : requêtes HTTP bloquantes ; Celery/Redis ; workers parallèles.
- **Références** : brief §27-§30, §51.

## ADR-0008 — Schéma SQLite WebUI sans migrations au MVP

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la base WebUI ne porte que des données propres (users, sessions) et son
  schéma est encore très mouvant ; le brief impose une exploitation simple (une image,
  aucune dépendance d'infrastructure).
- **Décision** : SQLAlchemy 2 avec `create_all` au démarrage, sans Alembic.
- **Conséquences** : tout changement de schéma (prévu en Phase 3 : jobs, notifications,
  audit) devra faire l'objet d'une décision explicite (introduction d'Alembic ou
  migration manuelle) ; pas de downgrade possible.
- **Alternatives écartées** : Alembic dès M1 (complexité non justifiée) ; SQL manuel.
- **Références** : brief §45-§46, principes §2 et §11.

## ADR-0009 — Types frontend générés depuis un OpenAPI versionné

- **Statut** : acceptée — 2026-09-17
- **Contexte** : le brief impose de générer les types TypeScript depuis l'OpenAPI FastAPI
  plutôt que de recopier les DTO ; la CI ne dispose pas d'un serveur lancé pour interroger
  `/openapi.json`.
- **Décision** : `backend/openapi.json` est exporté par `python -m app.export_openapi` et
  versionné ; `frontend/src/api/schema.d.ts` est généré par `openapi-typescript`
  (`npm run gen:api`) et versionné aussi.
- **Conséquences** : toute modification d'API doit régénérer les deux fichiers dans le
  même changement ; `openapi-typescript` 7 exige TypeScript 5.x, ce qui épingle le
  frontend à `typescript ~5.9` malgré le template Vite 8 (TS 6).
- **Alternatives écartées** : types écrits à la main ; export OpenAPI à la volée en CI
  depuis un serveur éphémère (plus complexe pour un bénéfice identique).
- **Références** : brief §68, ADR-0004.

## Décisions ouvertes

À trancher explicitement puis consigner en ADR (voir brief §72) :

- format d'implémentation de `ssdv2ctl` : Python, Bash robuste ou hybride ;
- liste des commandes container-compatibles vs host-only ;
- emplacement de maintenance des métadonnées de présentation du catalogue (catégories,
  icônes, tags).
