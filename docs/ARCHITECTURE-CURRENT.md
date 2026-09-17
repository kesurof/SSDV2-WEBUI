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
  `GET /api/v1/apps/{app}/logs` (conteneur rattaché à l'application, lignes, horodatage),
  `GET /api/v1/system/summary` (hôte via Docker info, branche/commit SSDV2, compteurs),
  `GET /api/v1/diagnostics` via l'adaptateur `ssdv2ctl` (`app/adapters/ssdv2_cli.py`,
  commandes allowlistées, `shell=False`, `SSDV2CTL_PATH`/`SSDV2CTL_TIMEOUT`).
- `frontend/` : React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4 + shadcn/ui +
  TanStack Query v5 + TanStack Table v9 + React Router v7 ; login, layout, dashboard,
  table des applications (recherche, filtres, badges d'état, alertes, bandeau mode
  dégradé), page de détail d'application (vue générale, conteneurs, logs, volumes,
  réseau/DNS), page Diagnostics.
- `Dockerfile` : multi-stage Node 22 → `python:3.13-slim`, utilisateur non root
  (`uid 10001`), frontend compilé servi par FastAPI, healthcheck `/health`.
- `compose.yaml` : conteneur unique `ssdv2-webui` lié à `127.0.0.1:8800`, socket Docker,
  binaire Docker de l'hôte monté, dossier `ssdv2ctl` de développement monté sur
  `/opt/ssdv2ctl`, `SSDV2_SOURCE` et `SSDV2_STORAGE` montés, volume nommé `webui-data`
  pour `/data`.
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

- Aucune mutation via la WebUI : `ssdv2ctl` (clone local non poussé, ADR-0010) est complet
  pour la lecture, les actions, le cycle de vie, l'auth et les diagnostics (ADR-0011 à
  ADR-0013), et la WebUI ne l'utilise que pour `GET /api/v1/diagnostics` (ADR-0014).
- Aucun job, aucune file, aucun SSE, aucune notification persistante.
- Aucun dashboard, page de détail d'application, logs, diagnostics, sauvegardes, pages
  Docker/réseau, command palette, thème.
- Aucune exposition publique (Traefik), aucune image publiée sur GHCR, aucun multiarch.
- Aucune migration de schéma (SQLAlchemy `create_all` uniquement — ADR-0008).

## Contexte externe (non vérifié par ce dépôt)

SSDV2 (`~/seedbox-compose`, branche `master`) reste la source de vérité : catalogue,
`ssddb`, label `ssdv2.app` (absent des conteneurs installés avant son introduction),
registres, `account.yml`. Ces éléments vivent dans le dépôt SSDV2 et sur le serveur.
