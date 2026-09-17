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
  `GET /api/v1/diagnostics` via l'adaptateur `ssdv2ctl` (`app/adapters/ssdv2_cli.py`,
  commandes allowlistées, `shell=False`, `SSDV2CTL_PATH`/`SSDV2CTL_TIMEOUT`).
- `frontend/` : React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4 + shadcn/ui +
  TanStack Query v5 + TanStack Table v9 + React Router v7 ; login, layout, dashboard,
  table des applications (recherche, filtres, badges d'état, alertes, bandeau mode
  dégradé), page de détail d'application (vue générale avec authentification, conteneurs,
  logs avec suivi SSE, volumes, réseau/DNS, actions installer/démarrer/arrêter/redémarrer/
  recréer/réinstaller/supprimer avec confirmations graduées), page Jobs (liste + détail
  avec événements SSE), page Diagnostics.
- `Dockerfile` : multi-stage Node 22 → `python:3.13-slim`, entrypoint PUID/PGID
  (`setpriv --init-groups`, ADR-0017), frontend compilé servi par FastAPI, healthcheck
  `/health`, runtime SSDV2 : ansible (`ansible-core` 2.21.0, collections
  `community.docker`/`community.general`/`ansible.posix`, rôles `kwoodson.yedit`/
  `geerlingguy.docker` dans `/opt/ansible`), outils CLI `jq`, `sqlite3`, `curl`,
  `gettext`, `htpasswd`, `pigz`, `sudo` (image ~442 Mo).
- `compose.yaml` : conteneur unique `ssdv2-webui` lié à `127.0.0.1:8800`, exécuté avec
  l'UID/GID de l'utilisateur SSDV2 (`SSD_UID`/`SSD_GID`, ADR-0017), socket Docker,
  binaire Docker de l'hôte monté, `SSDV2CTL_PATH` et `HOME` pointant vers l'utilisateur
  SSDV2, dossier `ssdv2ctl` de développement monté sur `/opt/ssdv2ctl`, fichiers
  `~/.config/ssd/env` et `~/.vault_pass` montés en lecture seule (nécessaires à
  `get_from_account_yml`), `SSDV2_SOURCE` et `SSDV2_STORAGE` montés, volume nommé
  `webui-data` pour `/data`. Ansible n'est pas disponible dans le conteneur.
- `.github/workflows/ci.yml` : runner `[self-hosted, SSDV2-WEBUI]` (ARM64) ; backend
  (ruff + pytest) et frontend (oxlint + tsc + Vitest + build) dans des conteneurs Docker,
  puis `docker build`.
- `backend/openapi.json` et `frontend/src/api/schema.d.ts` : générés et versionnés
  (ADR-0009).

## Exécution constatée

- Serveur de test `exemple.tld` : clone `~/ssdv2-webui`, conteneur `ssdv2-webui` démarré,
  `/health` → `{"status":"ok","docker":true,"ssdv2":true,"database":true}`,
  `GET /api/v1/apps` → 183 entrées dont 8 installées et 8 en marche, 0 alerte.
- Données lues : catalogue `services-available` (183), `ssddb` (11 entrées, dont 3 hors
  catalogue), registres `~/seedbox/conf` (8 applications), 19 conteneurs Docker.
- L'application reste accessible derrière un tunnel SSH uniquement (pas de route Traefik).

## Ce qui n'existe pas (à ce jour)

- Aucune notification persistante, aucun audit, aucun backup, aucune commande
  `ssdv2ctl config` (reportés en Phase 4).
- Aucune sauvegarde, page Docker/réseau, command palette, thème, aucun confort de logs
  (recherche, pause).
- Aucune exposition publique (Traefik), aucune image publiée sur GHCR, aucun multiarch.
- Aucune migration de schéma (SQLAlchemy `create_all` uniquement — ADR-0008).

## Contexte externe (non vérifié par ce dépôt)

SSDV2 (`~/seedbox-compose`, branche `master`) reste la source de vérité : catalogue,
`ssddb`, label `ssdv2.app` (absent des conteneurs installés avant son introduction),
registres, `account.yml`. Ces éléments vivent dans le dépôt SSDV2 et sur le serveur.
