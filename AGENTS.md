# AGENTS.md — SSDV2 WebUI

## État du dépôt

M1 (lecture seule) déployé sur le serveur de test. Backend `backend/` (FastAPI + pytest),
frontend `frontend/` (React/Vite/shadcn/TanStack), `Dockerfile` multi-stage,
`compose.yaml`, CI self-hosted `.github/workflows/ci.yml`. Détails :
`docs/ARCHITECTURE-CURRENT.md`.

## Commandes

- Tests backend (Python 3.13, identique à la CI, depuis la racine) :
  `docker run --rm -v "$PWD/backend:/src:ro" -v ssdv2-webui-pip-cache:/root/.cache/pip -w / python:3.13-slim sh -c "cp -r /src /work && cd /work && pip install -q -e '.[dev]' && ruff check . && ruff format --check . && pytest"`
- Frontend (depuis `frontend/`) : `npm ci && npm run lint && npm run typecheck && npm run test && npm run build`
- Types API : régénérer `backend/openapi.json` (`python -m app.export_openapi`, même
  conteneur que les tests) puis `npm run gen:api` — les deux fichiers sont versionnés.
- Image : `docker build -t ssdv2-webui:local .`
- Serveur de test : `ssh utilisateur@198.51.100.10 "cd ~/ssdv2-webui && git pull && docker compose up -d --build"` ;
  UI sur `127.0.0.1:8800` uniquement (tunnel : `ssh -L 8800:127.0.0.1:8800 utilisateur@198.51.100.10`).

## Documentation

`docs/README.md` est le routeur documentaire : état actuel, cible, décisions, roadmap,
chantier en cours, historique. Les règles permanentes de conception sont dans
`docs/DEVELOPMENT-PRINCIPLES.md`. `docs/SSDV2_WEBUI_PROJECT_BRIEF.md` reste la conception
détaillée de référence ; sections les plus contraignantes : §62 (interdits), §71 (règles
agent), §72 (décisions à trancher), §75 (stack).

## Règles non négociables

1. Ne jamais réutiliser le code ou l'architecture de l'ancienne WebUI (`ssd-frontend`,
   `ssd-backend`, `saison-frontend`).
2. SSDV2 reste la source de vérité (catalogue `services-available`, `ssddb`, label Docker
   `ssdv2.app`, registres `<app>.containers|.volumes|.dns`, `account.yml`). La SQLite WebUI
   ne stocke que ses données propres (users, sessions, jobs, notifications, audit,
   settings, favorites), jamais l'état des applications.
3. Une seule image Docker, un seul conteneur. Pas de Redis, Celery, PostgreSQL, serveur
   Node en production, ni microservices.
4. Toute mutation passe par un service backend : les routes HTTP ne contiennent pas de
   logique SSDV2 ; React ne connaît ni bash, ni Ansible, ni CLI Docker, ni chemins
   internes, ni Vault.
5. Entrées subprocess validées/typées/allowlistées ; jamais `shell=True` avec des données
   HTTP ; noms d'apps issus du catalogue SSDV2.
6. Ne jamais logger ni renvoyer un secret (token Cloudflare, mot de passe Vault, cookies,
   Authorization). Redaction centralisée ; secrets masqués en UI.
7. Opérations hôte (UFW, iptables, apt, systemd, /etc, kernel, users) hors MVP : pas de
   `--privileged`, `/:/host`, `nsenter` sans décision architecturale explicite.
8. Opérations longues = jobs non bloquants (worker de mutation unique, file en mémoire +
   état SQLite, SSE) ; au démarrage, les jobs `running` repassent à `interrupted`.
9. Actions destructrices : confirmation graduée (§53) ; pas de terminal shell web.
10. `ssdv2ctl` (non interactif, JSON) est la frontière avec SSDV2 ; inspecter le mécanisme
    SSDV2 existant avant toute modification, ne pas réinventer depuis un nom de fonction.

## Stack retenue (ADR-0004, brief §75)

- Frontend : React, TypeScript, Vite, shadcn/ui, Tailwind, TanStack Table/Query,
  React Router, React Hook Form, Zod, Sonner, Lucide.
- Backend : Python 3.13, FastAPI, Pydantic, Docker SDK, SQLite, SQLAlchemy 2, SSE, pytest.
- Tests frontend : Vitest + React Testing Library.
- Packaging : Docker multi-stage, GHCR `ghcr.io/projetssd/ssdv2-webui`,
  `linux/amd64` + `linux/arm64`.

## Conventions

- Tranches verticales, pas d'abstraction anticipée : voir `docs/DEVELOPMENT-PRINCIPLES.md`
  §8 et §11.
- API préfixée `/api/v1` ; générer les types TypeScript depuis l'OpenAPI FastAPI.
- État Docker récupéré de façon groupée (endpoint agrégé pour la table, pas d'appel
  Docker par ligne).
- Mode dégradé obligatoire : démarrer et afficher l'erreur si Docker/SSDV2/SQLite
  indisponibles, sans crash-loop.
- UI en français, textes hors des composants (i18n ultérieure) ; admin dense orientée
  desktop (type Portainer/Coolify), pas de galerie de cartes.

## Documentation et synchronisation

- Lire `docs/README.md` et le document de référence du domaine avant toute modification.
- Toute modification fonctionnelle aligne code, tests et documentation dans le même
  changement (checklist : `docs/DEVELOPMENT-PRINCIPLES.md` §18) ; une décision durable
  devient un ADR dans `docs/DECISIONS.md`.
- Ne jamais présenter comme existant ce qui est cible, recommandé ou prévu : ces
  informations vivent dans `docs/ARCHITECTURE-TARGET.md`, `docs/ROADMAP.md` ou
  `docs/PROGRESS.md`.
- Une information n'a qu'un seul emplacement de référence ; les autres documents la
  référencent au lieu de la recopier.
- `AGENTS.md` reste compact : uniquement des rappels opérationnels, pas d'explications
  détaillées (celles-ci vivent dans la documentation permanente).
