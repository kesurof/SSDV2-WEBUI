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

## ADR-0018 — Authentification interne désactivable (auth déléguée au proxy amont)

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la WebUI est exposée via Traefik derrière `chain-oauth2-proxy@file` ;
  lorsque l'authentification est déjà assurée en amont, le login admin interne fait
  doublon. Un réglage administrable est demandé.
- **Décision** : réglage WebUI `internal_auth` (table `webui_settings`, **activé par
  défaut**), modifiable via `PATCH /api/v1/security` par un admin authentifié. Désactivé :
  les routes n'exigent plus de session (utilisateur synthétique `auth-externe`), `login`
  et `logout` répondent 409, toutes les sessions existantes sont supprimées ; la
  protection CSRF double-submit est conservée pour les mutations (cookie émis par
  `/auth/me`). La désactivation exige une confirmation forte (saisie de « DESACTIVER »).
- **Conséquences** : la sécurité repose alors sur le proxy amont et sur le fait que le port
  local `127.0.0.1:8800` n'est pas exposé ; toute personne atteignant la WebUI dispose d'un
  accès complet (socket Docker) ; réactiver l'authentification ferme les sessions et
  impose une reconnexion.
- **Alternatives écartées** : supprimer l'authentification interne (pas de retour arrière,
  inutilisable en accès direct) ; coder en dur l'absence d'auth derrière un proxy.
- **Références** : brief §12-§13, ADR-0004, ADR-0017.

## ADR-0019 — Assistant de premier démarrage (wizard) protégé par jeton

- **Statut** : acceptée — 2026-09-17
- **Contexte** : en distribution (image GHCR), exiger le mot de passe admin par variable
  d'environnement est peu sûr (visible dans `docker inspect`) et un setup ouvert tant
  qu'aucun compte n'existe permettrait à un visiteur distant de s'approprier l'instance.
- **Décision** : au premier démarrage sans compte, un assistant `/setup` (public) prend la
  main, protégé par un **jeton d'installation** généré au démarrage (fichier
  `WEBUI_DATA/setup-token` en 0600 + journalisé une fois, supprimé après succès). Le wizard
  crée le compte admin (Argon2id, mot de passe ≥ 12 caractères et ≠ identifiant), règle
  `internal_auth`, `instance_name` et `notify_job_success`, marque `setup_completed` puis
  ferme définitivement `/setup` (409). La voie par variables d'environnement
  (`WEBUI_ADMIN_PASSWORD`) reste supportée et marque aussi `setup_completed`.
- **Conséquences** : `WEBUI_ADMIN_PASSWORD` devient optionnel dans le compose ; la
  procédure d'installation dépend de la lecture du jeton (journaux ou fichier de données) ;
  les installations existantes (compte présent) ne voient jamais le wizard ;
  `setup_required` = aucun utilisateur **et** `setup_completed` ≠ true.
- **Alternatives écartées** : setup non protégé (course à l'appropriation) ; wizard
  uniquement accessible en local (faussé derrière un proxy) ; supprimer la voie env
  (perte de l'automatisation).
- **Références** : brief §13, §12 ; ADR-0018.

## ADR-0020 — Distribution comme application SSDV2 standard (`ssdv2webui`)

- **Statut** : acceptée — 2026-09-17
- **Contexte** : le déploiement de référence était un `compose.yaml` ad hoc, non géré par
  SSDV2 (pas de registre, pas de suppression/relance standard). L'objectif est une
  installation par le menu SSDV2 comme n'importe quelle application, sur n'importe quelle
  instance, sans dépendance aux chemins de développement (`~/ssdv2-ctl-dev`) ni au binaire
  Docker de l'hôte.
- **Décision** :
  - l'application SSDV2 s'appelle **`ssdv2webui`** (nom `webui` réservé au stub de
    l'ancienne WebUI, conservé tel quel) : fichier `includes/dockerapps/vars/ssdv2webui.yml`
    (image `ghcr.io/kesurof/ssdv2-webui:latest`, `intport: 8000`, aucun port hôte publié,
    labels Traefik génériques et choix d'auth à l'installation) ;
  - l'image est publiée **publique** sur GHCR (aucun secret embarqué) pour un pull
    universel sans credentials ;
  - l'image embarque le **CLI Docker** (binaire statique, par architecture) et
    **`ssdv2ctl` vendored** dans `/usr/local/bin` (copie épinglée de
    `~/Developer/ssdv2/ssdv2ctl`, resynchronisée via `scripts/sync-ssdv2ctl.sh`, hash
    relevé à chaque synchronisation) ; les chemins par défaut du backend dérivent de
    `HOME` ;
  - conventions linuxserver adoptées : `PUID`/`PGID`/`TZ` (entrypoint existant,
    ADR-0017), `tzdata` et montage `/etc/localtime`, données dans
    `{{ settings.storage }}/docker/{{ USER }}/ssdv2webui/data` ;
  - le compte admin est créé par l'assistant `/setup` (ADR-0019), aucun secret dans les
    variables de l'application ; la surcharge `~/seedbox/vars/ssdv2webui.yml` permet
    d'installer sans modifier le dépôt SSDV2 (ADR-0010) ;
  - `compose.yaml` devient la voie de développement local.
- **Conséquences** : l'application apparaît dans le catalogue SSDV2 et se gère via
  `ssdv2ctl`/menu (install, remove, reinstall, restart, backup) ; la resynchronisation de
  `ssdv2ctl` devient une étape de release ; l'image grossit d'environ 60 Mo ; la double
  authentification (chaîne oauth2-proxy + login interne) reste en place et le défaut de
  POST derrière `oauth2-proxy` reste ouvert.
- **Alternatives écartées** : nom `webui` (collision avec le stub historique et son
  entrée de menu) ; paquet GHCR privé (pull non universel) ; base `linuxserver/baseimage`
  + s6 (aucun gain fonctionnel, Python 3.13 à réinstaller) ; montage d'un dossier hôte
  pour `ssdv2ctl` (non universel).
- **Références** : ADR-0010, ADR-0017, ADR-0018, ADR-0019 ; skill `add-app` SSDV2 ; brief
  §10, §75.

## ADR-0021 — Dépôt public : licence GPL-3.0, assainissement et release automatique

- **Statut** : acceptée — 2026-09-17
- **Contexte** : le dépôt et le paquet GHCR sont publics ; l'arbre et l'historique
  contenaient des données personnelles sans utilité pour les utilisateurs (domaine,
  chemins, IP, identifiants de test) et le compose de développement portait des défauts
  propres au serveur de test.
- **Décision** :
  - licence **GPL-3.0**, cohérente avec SSDV2 ;
  - purge des données personnelles de l'arbre **et de l'historique** (`git filter-repo`,
    réécriture des 56 commits puis force-push ; emails d'auteur remplacés par l'adresse
    noreply GitHub) ;
  - `compose.yaml` de développement générique : variables requises via `.env`
    (`.env.example` versionné), port local uniquement, aucun label, domaine ou réseau
    propre à un hôte ; montages obsolètes retirés (CLI Docker et `ssdv2ctl` sont embarqués
    dans l'image) ;
  - release automatique : push `main` → `:dev` + `:latest`, tag `v*` → `:<version>` +
    `:latest`, dispatch manuel conservé ;
  - description et topics du dépôt renseignés.
- **Conséquences** : les hashes des commits antérieurs changent (les références de hashes
  ont été retirées de la documentation, l'historique Git reste la source) ; les clones
  existants doivent être remis à niveau ; chaque push `main` republie l'image
  multiarchitecture.
- **Alternatives écartées** : conserver l'historique (données personnelles toujours
  accessibles) ; dépôt neuf sans historique (contredit « Histoire → Git ») ; compose
  supprimé (perte de la voie de développement locale).
- **Références** : ADR-0020 ; brief §75.

## ADR-0022 — Observabilité, historique par application et mises à jour d'images

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la maquette finale (`docs/SSDV2_WEBUI_MOCKUP_FINAL_UI.html`) introduit
  une page Santé (métriques hôte, contrôles), un historique par application, les
  ressources des conteneurs, l'affichage des variables non sensibles et un centre de
  mises à jour ; le brief limite le MVP aux opérations applicatives (pas d'opérations
  hôte).
- **Décision** :
  - métriques hôte (CPU/RAM) lues depuis `/proc/stat` et `/proc/meminfo` montés en
    lecture seule dans l'application SSDV2 (`/host/proc/...`) ; disque via
    `shutil.disk_usage` sur les montages SSDV2 ; conteneurs via l'instantané Docker
    groupé ;
  - `GET /api/v1/system/health` : contrôles de services, sauvegardes, jobs, alertes,
    résolution DNS et sonde TLS du domaine public (cache 5 min, « inconnu » en cas
    d'échec) ;
  - `GET /api/v1/apps/{app}/history` : agrégation jobs + audit + notifications +
    sauvegardes, filtrable (`job|audit|notification|backup|errors`) ;
  - `GET /api/v1/apps/{app}/stats` (CPU/RAM par conteneur, cache 15 s) et
    `GET /api/v1/apps/{app}/env` limité à une **allowlist stricte** (TZ, PUID, PGID,
    UMASK, LANG, LC_ALL, préfixe `DOZZLE_`) avec refus de tout nom contenant un marqueur
    sensible (PASSWORD, TOKEN, SECRET, KEY, VAULT…) ;
  - `GET /api/v1/updates` : comparaison digest local / digest registre par image
    d'application installée (cache 30 min, statut `unknown` en cas d'échec) ; l'action
    « Mettre à jour » réutilise le job `app_recreate` (pull + recreate) ;
  - le système (Docker Engine, OS, SSDV2 Core), la restauration de sauvegarde et les
    paramètres éditables restent hors périmètre (Phase 5).
- **Conséquences** : la définition SSDV2 monte `/proc/stat` et `/proc/meminfo` en lecture
  seule ; les appels Docker stats/registre sont mis en cache et jamais faits dans la
  table des applications ; la maquette devient la référence de design versionnée.
- **Alternatives écartées** : métriques limitées aux conteneurs (imprécises) ; historique
  côté client uniquement (appels multiples) ; affichage des variables sans allowlist
  (risque de fuite de secret, règle 6) ; mises à jour système depuis la WebUI (règle 7).
- **Références** : ADR-0004, ADR-0020 ; brief §62, §75 ; règles 6 et 7 (`AGENTS.md`).

## ADR-0023 — CI/CD sur runners GitHub-hosted (build multiarch natif)

- **Statut** : acceptée — 2026-09-17
- **Contexte** : la CI et la release tournaient sur un runner self-hosted ARM64 avec QEMU
  pour la branche amd64 ; le build complet durait ~9 min (mesuré : 201 s `pip install .`,
  186 s ansible, 151 s vite, 121 s npm ci en émulation) et reconstruisait toutes les
  couches à chaque exécution, deux fois (CI puis release).
- **Décision** :
  - dépôt public → runners GitHub-hosted gratuits et illimités : `ubuntu-latest` (x64) et
    `ubuntu-24.04-arm` (arm64) ; **fin de QEMU** ;
  - **pipeline unique** : tests backend/frontend, puis build de l'image par plateforme en
    matrice native, push par digest et fusion du manifeste multiarchitecture
    (`docker buildx imagetools create`) ; publication `:dev` + `:latest` sur `main`,
    `:<tag>` + `:latest` sur tag `v*`, uniquement si les tests passent ;
  - cache BuildKit `type=gha,mode=max` par plateforme (couches npm/pip/apt/galaxy/CLI
    réutilisées entre les exécutions) et caches pip/npm des jobs de tests ;
  - métadonnées OCI (`docker/metadata-action`) et attestations de provenance + SBOM à la
    publication ;
  - le runner self-hosted est retiré (dépôt et serveur) et les caches Docker associés
    sont supprimés.
- **Conséquences** : plus de charge de build sur le serveur de test ; un seul build par
  push ; `:latest` ne peut plus provenir d'un commit aux tests rouges ; les runs de PR
  construisent l'image sans publier.
- **Alternatives écartées** : conserver QEMU sur le runner self-hosted (lent) ; deux
  workflows avec gating `workflow_run` (plus de pièces mobiles) ; runners payants (le
  dépôt est public).
- **Références** : ADR-0021 ; `AGENTS.md`.

## Décisions ouvertes

À trancher explicitement puis consigner en ADR (voir brief §72) :

- format d'implémentation de `ssdv2ctl` : tranché (Python stdlib + dispatcher Bash
  existant) — reste la levée de l'ADR-0010 à la finalisation ;
- liste des commandes container-compatibles vs host-only ;
- emplacement de maintenance des métadonnées de présentation du catalogue (catégories,
  icônes, tags) ;
- résorption de la duplication du parsing catalogue entre la WebUI et `ssdv2ctl`.
