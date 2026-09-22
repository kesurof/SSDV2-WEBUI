# AGENTS.md — SSDV2 WebUI

## État du dépôt

Déployé sur le serveur de test comme application SSDV2 `ssdv2webui` (ADR-0020). Backend
`backend/` (FastAPI + pytest), frontend `frontend/` (React/Vite/shadcn/TanStack),
`Dockerfile` multi-stage (CLI Docker et `ssdv2ctl` embarqués), `compose.yaml` (voie de
développement), CI/CD sur runners GitHub-hosted (tests puis build multiarch natif et
publication GHCR si vert — ADR-0023). Détails : `docs/ARCHITECTURE-CURRENT.md`.

## Commandes

- Tests backend (Python 3.13, identique à la CI) : depuis `backend/`,
  `python3 -m venv .venv && .venv/bin/pip install -e '.[dev]' && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest`
  (repli hors Python local : `docker run --rm -v "$PWD/backend:/src:ro" -w / python:3.13-slim sh -c "cp -r /src /work && cd /work && pip install -q -e '.[dev]' && ruff check . && ruff format --check . && pytest"`)
- Frontend (depuis `frontend/`) : `npm ci && npm run lint && npm run typecheck && npm run test && npm run build`
- Types API : régénérer `backend/openapi.json` (`python -m app.export_openapi`) puis
  `npm run gen:api` — les deux fichiers sont versionnés.
- Image : `docker build -t ssdv2-webui:local .`
- Serveur de test privé (détails hors dépôt) : application SSDV2 `ssdv2webui`
  (image `ghcr.io/kesurof/ssdv2-webui:latest`, définition
  `includes/dockerapps/vars/ssdv2webui.yml` côté SSDV2, données sous
  `~/seedbox/docker/<utilisateur>/ssdv2webui/data`). Mise à jour : pousser sur `main`
  (publication automatique si la CI est verte), puis sur le serveur
  `relance_container ssdv2webui` (fonction SSDV2 chargée au login via `profile.sh` ;
  recrée le conteneur et pull `:latest` via `generique.yml`, `pull` par défaut).
  `ssdv2ctl` n'est présent que dans l'image, pas sur l'hôte. Le compose local reste la
  voie de développement (voir `.env.example`).
- `ssdv2ctl` (Phase 0 complète, clone local `~/Developer/ssdv2`, branche `wip/ssdv2ctl`,
  jamais de push — ADR-0010) : tests
  `docker run --rm -v "$PWD:/src:ro" -w / python:3.13-slim sh -c "cp -r /src /work && cd /work && python3 -m unittest discover -s tests/python"` ;
  validation serveur : `rsync` vers `~/ssdv2-ctl-dev` puis exécution avec
  `SETTINGS_SOURCE=~/seedbox-compose SETTINGS_STORAGE=~/seedbox`.
- Adaptateur WebUI : `SSDV2CTL_PATH` (défaut `/usr/local/bin/ssdv2ctl`, embarqué dans
  l'image — `scripts/sync-ssdv2ctl.sh` resynchronise la copie vendored) et
  `SSDV2CTL_TIMEOUT` ; le compose de développement monte `SSDV2CTL_DIR` (défaut
  `~/ssdv2-ctl-dev`) sur `/opt/ssdv2ctl`. Toute nouvelle commande ssdv2ctl exposée doit
  être ajoutée à l'allowlist de `app/adapters/ssdv2_cli.py` (jamais de shell).

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
11. Ne jamais créer de branche ni de pull request sur `projetssd/ssdv2` tant que le projet
    n'est pas finalisé (ADR-0010) : le développement lié à SSDV2 reste local.

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
  desktop (type Portainer/Coolify), pas de galerie de cartes. Suivre la maquette de
  référence `docs/SSDV2_WEBUI_MOCKUP_FINAL_UI.html` : tokens clair/sombre, icônes Lucide,
  composants transverses (`src/components/app/`).

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
