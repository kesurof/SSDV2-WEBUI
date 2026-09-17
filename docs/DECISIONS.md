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

## ADR-0010 — Aucune branche ni PR sur projetssd/ssdv2 avant finalisation du projet

- **Statut** : acceptée — 2026-09-17 (décision du propriétaire du projet)
- **Contexte** : le développement de la WebUI s'appuie sur le clone SSDV2 du serveur de
  test et la Phase 0 prévoit d'y introduire `ssdv2ctl`. Le dépôt amont `projetssd/ssdv2`
  ne doit pas recevoir de contributions tant que la WebUI n'est pas finalisée.
- **Décision** : aucune branche ni pull request sur `projetssd/ssdv2` pendant toute la
  durée du projet ; tout développement lié à SSDV2 reste local (non poussé). La contrainte
  ne pourra être levée que par une décision explicite ultérieure.
- **Conséquences** : la Phase 0 (`ssdv2ctl`) est développée localement et ne peut pas être
  proposée en amont ; le clone local peut diverger de l'amont et devra être revérifié
  avant toute contribution finale ; les évolutions SSDV2 nécessaires sont regroupées puis
  proposées en une seule fois à la fin.
- **Alternatives écartées** : branche + PR immédiate sur `projetssd/ssdv2` ; fork public
  pendant le développement.
- **Références** : brief §9 et §63 (Phase 0), [`PROGRESS.md`](PROGRESS.md).

## ADR-0011 — Contrat de sortie de `ssdv2ctl` (palier lecture seule)

- **Statut** : acceptée — 2026-09-17
- **Contexte** : `ssdv2ctl` devient la frontière stable entre SSDV2 et les interfaces
  (WebUI, CLI) ; il faut un contrat vérifiable, non interactif et sans logique dupliquée
  (ADR-0005).
- **Décision** :
  - commandes : `apps list`, `app status <app>` ; JSON par défaut sur stdout, erreurs JSON
    structurées `{"error": {"code", "message"}}` sur stderr, codes de sortie 0/1/2 ;
  - le JSON porte un champ `schema` versionné ;
  - `app status` expose des **faits bruts** (ligne `ssddb`, registres
    `.containers/.volumes/.dns`, conteneurs) avec les sources présentes et des alertes
    (`ssddb_unavailable`, `docker_unavailable`) ; l'agrégation `AppState` reste côté WebUI
    (brief §48/§50) ;
  - le nom d'application est validé contre le catalogue (allowlist, brief §12) ;
  - la correspondance application → conteneurs réutilise le mécanisme SSDV2 existant
    (`generique.sh collect_app_containers` : label + registre + conventions) au lieu d'être
    réimplémentée.
- **Conséquences** : le parsing du catalogue reste temporairement dupliqué entre la WebUI
  et `ssdv2ctl` (implémentations alignées, à résorber par une décision ultérieure) ;
  toute évolution du contrat doit incrémenter `schema` et mettre à jour les tests.
- **Alternatives écartées** : sortie texte par défaut ; agrégation complète de l'état dans
  `ssdv2ctl` ; réimplémentation Python du rattachement des conteneurs ; `shell=True`.
- **Références** : brief §9, §48, §71 (règles 1, 5, 6, 8), ADR-0005, ADR-0010.

## ADR-0012 — Actions `start`/`stop`/`restart` dans `ssdv2ctl`

- **Statut** : acceptée — 2026-09-17
- **Contexte** : SSDV2 n'a pas de commande non interactive start/stop/restart au niveau
  d'une application ; sa fonction historique `relance_container` **recrée** le conteneur
  (image mise à jour possible), ce qui correspond au brief §21 « Recréer », pas à
  « Redémarrer ».
- **Décision** : `ssdv2ctl app start|stop|restart <app>` exécute `docker start|stop|restart`
  sur les conteneurs **existants** de l'application, résolus via le mécanisme SSDV2
  `collect_app_containers` (label + registre + conventions) puis filtrés par existence.
  - préconditions en échec : `unknown_app`, `docker_unavailable`, `no_containers`
    (stderr JSON, stdout vide, code 1) ;
  - résultat : stdout JSON `{schema, app, action, ok, containers[{name, ok, error}]}`,
    code 0 si tout est ok ; échec total ou partiel → stdout détaillé + stderr
    `action_failed`, code 1 ;
  - aucune suppression de conteneur, volume ou donnée ; aucune confirmation interactive
    (la confirmation graduée est une exigence d'interface, brief §53).
- **Conséquences** : « redémarrer » (docker restart) et « recréer » (SSDV2
  `relance_container`) restent deux actions distinctes ; cette dernière est un palier
  ultérieur. Chaque conteneur est traité séparément pour un rapport précis (pas d'appel
  groupé).
- **Alternatives écartées** : réutiliser `relance_container` pour `restart` (sémantique de
  recréation) ; un seul `docker restart` multi-conteneurs (rapport par conteneur moins
  précis).
- **Références** : brief §8, §21, §53, ADR-0010, ADR-0011.

## ADR-0013 — Cycle de vie, auth et diagnostics dans `ssdv2ctl`

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la Phase 0 du brief demande install/remove/reinstall/start/stop/restart,
  auth et diagnostics non interactifs. Or `launch_service` devient interactif si
  `sub.<app>.<app>` ou `sub.<app>.auth` manquent, et `menu_reinit_container` (réinstall)
  est interactif (lecture finale) et réinitialise l'auth dans `account.yml`.
- **Décision** :
  - `app install` : exige que `sub.<app>.<app>` et `sub.<app>.auth` existent dans
    `account.yml` ou soient fournis par `--subdomain`/`--auth` (allowlist) ; sinon
    `interactive_required`. Les clés manquantes sont écrites avant `launch_service`.
  - `app remove` : `suppression_appli <app> 0|1` ; les données ne sont supprimées
    qu'avec `--delete-data` (défaut : conservation).
  - `app reinstall` : séquence non interactive reproduisant `menu_reinit_container`
    (suppression avec données conservées, suppression des surcharges `conf|vars/<app>.yml`,
    restauration de sub/auth, `launch_service`) — le wrapper menu n'est pas appelé car
    interactif et destructeur pour l'auth.
  - `app recreate` : `relance_container` (suppression + recréation avec mise à jour de
    l'image, volumes et configuration conservés).
  - `auth get` lit `sub.<app>.auth` ; `auth set` écrit uniquement (`applied: false`) — un
    `recreate` applique le changement.
  - `diagnostics run` : lecture seule (registres manquants, conteneurs orphelins, volumes
    anonymes).
  - Environnement Bash : `PATH` enrichi du venv SSDV2 (`$SETTINGS_SOURCE/venv/bin`),
    stdin fermé (aucune invite ne peut aboutir), timeouts dédiés (install 1800 s).
- **Conséquences** : aucune commande n'attend d'entrée ; une valeur manquante produit une
  erreur explicite ; `recreate` et `reinstall` restent deux opérations distinctes.
- **Alternatives écartées** : appeler les wrappers de menu interactifs ; alimenter stdin
  avec des retours à la ligne (répond silencieusement aux invites — constaté : auth remise
  à `basique` par défaut lors d'une réinstallation).
- **Références** : brief §8, §9, §21, §53 ; ADR-0011, ADR-0012.

## ADR-0014 — Adaptateur WebUI pour `ssdv2ctl`

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la WebUI doit consommer `ssdv2ctl` sans shell ni logique SSDV2 dupliquée
  (brief §4/§9), alors que le conteneur n'embarque ni CLI Docker ni runtime SSDV2.
- **Décision** :
  - réglages `SSDV2CTL_PATH` (défaut `ssdv2ctl`) et `SSDV2CTL_TIMEOUT` ;
  - `Ssdv2CtlRunner` : allowlist de commandes, arguments filtrés, `shell=False`,
    `Ssdv2CtlError` structurée, sortie JSON validée ;
  - `GET /api/v1/diagnostics` (auth requise) exécute `ssdv2ctl diagnostics run` et renvoie
    le modèle `DiagnosticsOut` ; 503 si `ssdv2ctl` est indisponible, 502 si la commande
    échoue ;
  - le health expose un champ `ssdv2ctl` ;
  - compose (déploiement de test) : dossier `ssdv2ctl` de développement monté sur
    `/opt/ssdv2ctl` et binaire Docker de l'hôte monté sur `/usr/local/bin/docker` (le
    socket Docker reste nécessaire).
- **Conséquences** : l'adaptateur est testable avec des doublures ; les mutations WebUI
  (Phase 3) exigeront en plus le runtime SSDV2 complet (ansible + collections, jq) dans le
  conteneur — décision ouverte ci-dessous.
- **Alternatives écartées** : monter des scripts Bash ad hoc dans le conteneur ; appeler
  les fonctions SSDV2 directement depuis FastAPI (hors périmètre, brief §9).
- **Références** : brief §4, §9, §50-§52 ; ADR-0011, ADR-0013.

## ADR-0015 — Enrichissement de l'image avec ansible

- **Statut** : acceptée — 2026-09-17 (résout la décision ouverte de l'ADR-0014)
- **Contexte** : `install`/`remove`/`reinstall`/`recreate` passent par les playbooks SSDV2
  (`launch_service`, `suppression_appli`) ; le venv SSDV2 monté n'est pas exécutable dans
  le conteneur (`venv/bin/python` pointe vers `/usr/bin/python3`, absent de l'image).
- **Décision** : installer dans l'image `ansible-core==2.21.0`, les collections
  `community.docker:5.2.0`, `community.general:13.0.1`, `ansible.posix:2.2.0` et les rôles
  `kwoodson.yedit`, `geerlingguy.docker,8.0.0` (versions alignées sur le serveur), dans
  `/opt/ansible` (`ANSIBLE_COLLECTIONS_PATH`, `ANSIBLE_ROLES_PATH`, `ANSIBLE_INVENTORY`
  avec un inventaire local, `ANSIBLE_HOME`/`ANSIBLE_LOCAL_TEMP` dans `/tmp`). Le mot de
  passe Vault est fourni au déploiement via `ANSIBLE_VAULT_PASSWORD_FILE`.
- **Conséquences** : image plus lourde (mesurée après build) ; l'interpréteur des modules
  est celui de l'image (Python 3.13), pas le venv hôte ; toute nouvelle collection utilisée
  par SSDV2 devra être ajoutée à l'image ; les versions doivent être réalignées lors des
  mises à jour SSDV2.
- **Alternatives écartées** : installer `python3.12` dans l'image pour exécuter le venv
  hôte (couplage à l'hôte, fragile) ; exécuter les mutations hors du conteneur (contraire
  au choix d'une image unique) ; reporter les mutations.
- **Références** : brief §10, §54, §72 ; ADR-0014.

## ADR-0016 — Micro-migrations SQL idempotentes au démarrage

- **Statut** : acceptée — 2026-09-17
- **Contexte** : ADR-0008 exclut Alembic au MVP mais le schéma a évolué (`jobs.params`),
  et `create_all` n'ajoute pas de colonne à une table existante.
- **Décision** : `init_db` applique une liste explicite de migrations idempotentes
  (`PRAGMA table_info` puis `ALTER TABLE ... ADD COLUMN` si absent), sans outil externe ;
  chaque nouvelle évolution du schéma ajoute une entrée à cette liste.
- **Conséquences** : les migrations restent manuelles et additives (pas de suppression de
  colonne, pas de transformation de données) ; une complexification future (renommage,
  données) exigera de reconsidérer Alembic.
- **Alternatives écartées** : Alembic dès maintenant ; recréer la base à chaque évolution ;
  stocker les paramètres hors schéma.
- **Références** : ADR-0008, brief §45-§46.

## ADR-0017 — Conteneur exécuté avec l'UID de l'utilisateur SSDV2

- **Statut** : acceptée — 2026-09-17
- **Contexte** : les mutations écrivent dans le stockage SSDV2 (`~/seedbox` :
  `account.yml`, registres, `vars/`) et dans le dépôt source ; ces chemins appartiennent à
  l'utilisateur hôte. Le conteneur tournait avec l'utilisateur embarqué `webui`
  (uid 10001) → `Permission denied` à l'installation.
- **Décision** : exécuter le conteneur avec l'UID/GID de l'utilisateur SSDV2 via un
  entrypoint PUID/PGID : l'entrypoint démarre en root, crée l'utilisateur `ssdv2` avec
  l'UID/GID fournis, installe une règle `sudo` sans mot de passe (nécessaire aux tâches
  Ansible `become`), aligne la propriété de `/data`, puis abandonne les privilèges
  (`gosu`) ; le volume `webui-data` appartient à cet UID.
- **Conséquences** : l'image ne fixe plus d'utilisateur final (`USER` retiré) ; le
  conteneur dispose d'un `sudo` interne sans mot de passe — sans gain réel puisqu'il
  possède déjà le socket Docker (contrôle root de l'hôte) et le mot de passe Vault ;
  l'accès en écriture aux fichiers SSDV2 est équivalent à celui de l'utilisateur hôte.
- **Alternatives écartées** : rendre `~/seedbox` accessible en écriture à l'uid 10001
  (modification invasive et durable de l'hôte) ; exécuter les mutations hors du conteneur.
- **Références** : brief §10-§11, §72 ; ADR-0010, ADR-0015.

## Décisions ouvertes

À trancher explicitement puis consigner en ADR (voir brief §72) :

- format d'implémentation de `ssdv2ctl` : tranché (Python stdlib + dispatcher Bash
  existant) — reste la levée de l'ADR-0010 à la finalisation ;
- liste des commandes container-compatibles vs host-only ;
- emplacement de maintenance des métadonnées de présentation du catalogue (catégories,
  icônes, tags) ;
- résorption de la duplication du parsing catalogue entre la WebUI et `ssdv2ctl`.
