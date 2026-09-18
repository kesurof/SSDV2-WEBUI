# Architecture actuelle (vérifiée)

> État constaté le **2026-09-17**. Ce document ne décrit que ce qui existe réellement dans
> le dépôt et à l'exécution. La cible est dans [`ARCHITECTURE-TARGET.md`](ARCHITECTURE-TARGET.md),
> la conception détaillée dans le [brief](SSDV2_WEBUI_PROJECT_BRIEF.md).

## Composants réels

- `backend/` : FastAPI (Python 3.13), configuration par variables d'environnement,
  `GET /health` et `/api/v1/health`, auth admin (Argon2id, sessions serveur en SQLite,
  CSRF double-submit, rate limiting en mémoire), `GET /api/v1/apps` agrégeant catalogue,
  `ssddb`, registres `.containers/.volumes/.dns` et Docker SDK (un appel groupé),
  `GET /api/v1/apps/{app}` (détail : conteneurs, registres, entrée `ssddb`),
  `GET /api/v1/apps/{app}/auth` (type d'authentification via `ssdv2ctl auth get`),
  `GET /api/v1/apps/{app}/logs` (conteneur rattaché à l'application, lignes, horodatage)
  et `GET /api/v1/apps/{app}/logs/stream` (SSE, suivi en direct),
  `POST /api/v1/apps/{app}/start|stop|restart|install|remove|reinstall|recreate`
  (crée un job, 202), `GET /api/v1/jobs` et `/api/v1/jobs/{id}` (file de jobs, état en
  SQLite), `GET /api/v1/jobs/{id}/events` (SSE) et `POST /api/v1/jobs/{id}/cancel`,
  `GET /api/v1/system/summary` (hôte via Docker info, branche/commit SSDV2, compteurs),
  `GET /api/v1/system/metrics` (CPU/RAM hôte depuis `/host/proc`, disque, conteneurs),
  `GET /api/v1/system/health` (contrôles de services, sauvegardes, jobs, alertes, DNS,
  sonde TLS avec cache — ADR-0022), `GET /api/v1/apps/{app}/history` (jobs + audit +
  notifications + sauvegardes, filtrable), `GET /api/v1/apps/{app}/stats` (CPU/RAM par
  conteneur, cache) et `GET /api/v1/apps/{app}/env` (allowlist stricte), `GET /api/v1/updates`
  (digest local vs registre par image d'application, cache),
  `GET /api/v1/diagnostics` et `POST /api/v1/diagnostics/rebuild-registries|
  `GET /api/v1/notifications` (liste + non-lues), `PATCH /notifications/{id}/read`,
  `POST /notifications/read-all`, `GET /notifications/events` (SSE),
  `GET /api/v1/backups` (archives `~/backup`, monté) et
  `POST /api/v1/apps/{app}/backup` (job `app_backup`, mécanisme `sauve_one_appli`) ;
  `GET /api/v1/auth/apps` (auth par application) et `POST /api/v1/auth/bulk`
  (job `auth_bulk` : `auth set-many` puis recréation des applications sélectionnées
  pour appliquer, ADR-0024) ; `GET /api/v1/config` (clés non secrètes,
  lecture seule) ;   `GET`/`PATCH /api/v1/security` (authentification interne activable ou
  désactivable, ADR-0018) ; `GET /api/v1/setup/status` et `POST /api/v1/setup`
  (assistant de premier démarrage protégé par jeton, ADR-0019) ; le tout via
  l'adaptateur `ssdv2ctl` (`app/adapters/ssdv2_cli.py`, commandes allowlistées,
  `shell=False`, `SSDV2CTL_PATH`/`SSDV2CTL_TIMEOUT`).
- `frontend/` : React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4 + shadcn/ui +
  TanStack Query v5 + TanStack Table v9 + React Router v7 + Lucide + next-themes ;
  design system repris de la maquette de référence (`docs/SSDV2_WEBUI_MOCKUP_FINAL_UI.html`,
  ADR-0022) : tokens clair/sombre, sidebar en trois sections (Pilotage / Exploitation /
  Configuration), recherche globale ⌘K, badges, composants transverses (StatusPill,
  MetricCard, KeyValueList, ProgressBar) ; assistant de premier démarrage (`/setup`),
  login, dashboard (santé, compteurs, jobs récents, alertes, bandeau mises à jour),
  table des applications (filtres, pagination 20/page, badges d'état, alertes, bandeau
  mode dégradé), page de détail d'application (cartes Informations, Accès et réseau,
  Compagnons, Ressources, Sauvegardes, Déploiement, Liens ; onglets Conteneurs, Logs SSE,
  Volumes, Réseau/DNS, Variables, Historique ; actions avec confirmations graduées),
  pages Jobs (**deux colonnes** : liste filtrable + panneau de détail avec événements SSE,
  relance des jobs d'application), Notifications, Audit, **Santé**, Sauvegardes,
  **Mises à jour** (rafraîchissement forcé au chargement et via le bouton), Authentification
  (masse), Paramètres (lecture seule + sécurité), Diagnostics (réparations) et
  **Historique par application** (agrégé, export CSV) ; détail d'application : actions
  en en-tête (Ouvrir ↗ conditionnel, Démarrer/Arrêter, Redémarrer, Sauvegarder, menu),
  cartes Informations (avec « Depuis »), Stockage, Déploiement (faits Docker + Recréer) ;
  table des applications : colonnes « Actions rapides » et « Mise à jour ».
- `Dockerfile` : multi-stage Node 22 → `python:3.13-slim`, entrypoint PUID/PGID
  (`setpriv --init-groups`, ADR-0017), frontend compilé servi par FastAPI, healthcheck
  `/health`, runtime SSDV2 : ansible (`ansible-core` 2.21.0, collections
  `community.docker`/`community.general`/`ansible.posix`, rôles `kwoodson.yedit`/
  `geerlingguy.docker` dans `/opt/ansible`), outils CLI `jq`, `sqlite3`, `curl`,
  `gettext`, `htpasswd`, `pigz`, `sudo`, `tzdata` (image ~505 Mo) ; CLI Docker
  embarquée (binaire statique `download.docker.com`, par architecture) et `ssdv2ctl`
  vendored dans `/usr/local/bin` (copie épinglée, resynchronisée par
  `scripts/sync-ssdv2ctl.sh`) — plus aucune dépendance aux binaires ou chemins de
  l'hôte (ADR-0020). Les chemins par défaut du backend dérivent de `HOME`
  (`SSDV2_SOURCE`, `SSDV2_STORAGE`, `BACKUP_DIR`).
- `compose.yaml` (voie de **développement** uniquement) : variables requises via `.env`
  (`.env.example` versionné : `SSDV2_USER`, `SSDV2_UID`, `SSDV2_GID`, `DOCKER_GID`),
  conteneur unique `ssdv2-webui` lié à `127.0.0.1:8800`, socket Docker, montages SSDV2
  (`SSDV2_SOURCE`, `SSDV2_STORAGE`, `~/.config/ssd/env` et `~/.vault_pass` en lecture
  seule, nécessaires à `get_from_account_yml`, inventaire Ansible, `~/backup`), volume
  nommé `webui-data` pour `/data`, `WEBUI_ADMIN_PASSWORD` optionnel (sinon assistant de
  premier démarrage via le jeton `WEBUI_DATA/setup-token`, ADR-0019) ; `HOME`, `PUID`/
  `PGID` et `DOCKER_GID` suivent l'utilisateur hôte (ADR-0017). L'exposition Traefik et
  l'authentification relèvent du déploiement de référence, l'application SSDV2
  `ssdv2webui` (ADR-0020).
- `.github/workflows/ci.yml` : runners GitHub-hosted (`ubuntu-latest` + `ubuntu-24.04-arm`) ;
  backend (setup-python 3.13 + cache pip : ruff + pytest) et frontend (setup-node 22 +
  cache npm : lint, tsc, Vitest, build) en parallèle ; puis build de l'image par plateforme
  en matrice native (cache BuildKit `type=gha,mode=max`, métadonnées OCI, provenance et
  SBOM) et fusion du manifeste multiarchitecture (`docker buildx imagetools create`) ;
  publication `:dev` + `:latest` sur `main`, `:<tag>` + `:latest` sur tag `v*`, uniquement
  si les tests passent (ADR-0023) ; les runs de PR construisent sans publier.
- `backend/openapi.json` et `frontend/src/api/schema.d.ts` : générés et versionnés
  (ADR-0009).

## Exécution constatée

- Serveur de test privé (domaine d'exemple `exemple.tld`) : application SSDV2
  **`ssdv2webui`** — définition au catalogue (`vars/ssdv2webui.yml`, montages
  `/proc/stat` et `/proc/meminfo` en lecture seule) ; **installation retirée le
  2026-09-17** (conteneur, registres, ligne `ssddb`, entrées `account.yml`, données et
  enregistrement DNS supprimés via `ssdv2ctl app remove --delete-data`) pour permettre une
  installation vierge par l'utilisateur. Les validations ci-dessous datent de
  l'installation précédente.
- Validation `ssdv2ctl` sur `ssdv2webui` (installation précédente) : `app status`
  (`sources.docker/ssddb/registries` vrais), `app restart`, `app backup` (archive locale
  créée dans `~/backup`), `app remove --delete-data` (conteneur, registres, ligne `ssddb`,
  dossier de données et enregistrement Cloudflare supprimés) puis `app install
  --subdomain ssdv2 --auth oauth2-proxy` — cycle complet vert ; `/health` →
  `{"status":"ok","docker":true,"ssdv2":true,"ssdv2ctl":true,"database":true}`.
- Vérification locale de l'image (Docker Desktop, ADR-0022) : login 200,
  `GET /api/v1/system/metrics` (CPU/RAM hôte, 6 conteneurs, avertissement
  `storage_unavailable` attendu sans stockage SSDV2), `GET /api/v1/system/health`
  (services + DNS/TLS « inconnu » sur `127.0.0.1`), `GET /api/v1/updates` vide, SPA servie,
  aucune erreur dans les journaux.
- Migration des données (installation précédente) : base `webui.sqlite3` du volume
  `webui-data` copiée dans le dossier de l'application, sessions purgées, `internal_auth`
  réactivé ; API interne vérifiée (login 200, 184 applications dont `ssdv2webui`,
  25 jobs, 17 événements d'audit, 2 sauvegardes).
- Données lues : catalogue `services-available` (184), registres `~/seedbox/conf`
  (9 applications).
- Traefik : les routeurs historiques du fichier `~/seedbox/docker/traefik/rules/ssdv2.toml`
  (services morts sur les ports 3000/8080) ont été neutralisés (`.disabled`) car ils
  capturaient `/api/v1` et provoquaient des 504 ; l'exposition de la WebUI est décrite par
  les labels générés par SSDV2.
- Distribution : paquet GHCR **public** ; `docker pull ghcr.io/kesurof/ssdv2-webui:latest`
  anonyme validé depuis le serveur et `app reinstall` avec pull effectif (image du
  conteneur = digest publié), données et compte admin conservés.

## Ce qui n'existe pas (à ce jour)

- Aucune restauration de sauvegarde : le mécanisme SSDV2 est inopérant (entrée de menu
  retirée par le patch `20260916_remove_restore_menu`) ; la réparation appartient à
  SSDV2, ce projet se limite à lister et créer des sauvegardes.
- Aucune écriture de configuration depuis la WebUI : les paramètres sont en lecture seule
  (les modifications passent par les procédures SSDV2, ex. `menu_change_domaine`).
- Aucune mise à jour système (Docker Engine, OS, SSDV2 Core) ni restauration depuis la
  WebUI : le centre de mises à jour couvre uniquement les images d'applications
  (ADR-0022, Phase 5 pour le reste).
- `ghcr.io/kesurof/ssdv2-webui` publiée en multiarchitecture (tags `:latest` et `:dev`,
  dépôt et paquet publics, licence GPL-3.0) ; release automatique sur push `main`
  (`:dev` + `:latest`), tag `v*` pour les versions (ADR-0021).
- Aucune page Docker/réseau ni palette de commandes complète (la recherche globale filtre
  les applications).
- Aucune migration de schéma hors micro-migrations additives (ADR-0016).

## Contexte externe (non vérifié par ce dépôt)

SSDV2 (`~/seedbox-compose`, branche `master`) reste la source de vérité : catalogue,
`ssddb`, label `ssdv2.app` (absent des conteneurs installés avant son introduction),
registres, `account.yml`. Ces éléments vivent dans le dépôt SSDV2 et sur le serveur.
