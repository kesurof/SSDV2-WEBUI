# AGENTS.md — SSDV2 WebUI

## État du dépôt

Greenfield : aucun code, manifeste, test, CI, Dockerfile ou commande vérifiable. La
documentation et la conception existent (`README.md`, `docs/`), versionnées avec Git.
Ne pas inventer de commande. Dès qu'un outillage est ajouté, documenter ici les commandes
réelles et mettre à jour `docs/ARCHITECTURE-CURRENT.md`.

## Documentation

`docs/README.md` est le routeur documentaire : état actuel, cible, décisions, roadmap,
chantier en cours, historique. `docs/SSDV2_WEBUI_PROJECT_BRIEF.md` reste la conception
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

## Stack imposée (§75)

- Frontend : React, TypeScript, Vite, shadcn/ui, Tailwind, TanStack Table/Query,
  React Router, React Hook Form, Zod, Sonner, Lucide.
- Backend : Python 3.13, FastAPI, Pydantic, Docker SDK, SQLite, SQLAlchemy 2, SSE, pytest.
- Tests frontend : Vitest + React Testing Library.
- Packaging : Docker multi-stage, GHCR `ghcr.io/projetssd/ssdv2-webui`,
  `linux/amd64` + `linux/arm64`.

## Conventions

- Tranches verticales (backend → API → frontend → tests), pas d'abstractions avant le
  premier écran fonctionnel.
- API préfixée `/api/v1` ; générer les types TypeScript depuis l'OpenAPI FastAPI.
- État Docker récupéré de façon groupée (endpoint agrégé pour la table, pas d'appel
  Docker par ligne).
- Mode dégradé obligatoire : démarrer et afficher l'erreur si Docker/SSDV2/SQLite
  indisponibles, sans crash-loop.
- UI en français, textes hors des composants (i18n ultérieure) ; admin dense orientée
  desktop (type Portainer/Coolify), pas de galerie de cartes.

## Documentation et synchronisation

Code, tests et documentation doivent rester alignés :

- Lire `docs/README.md` et le document de référence du domaine avant toute modification.
- Une modification fonctionnelle met à jour, dans le même changement : les tests,
  `docs/ARCHITECTURE-CURRENT.md` si l'architecture réelle change, `docs/ROADMAP.md` et
  `docs/PROGRESS.md` si un statut change.
- Une décision durable (source de vérité, framework, dépendance majeure, abstraction
  interne, composants runtime, modèle client/serveur) devient un ADR dans
  `docs/DECISIONS.md`.
- Une information n'a qu'un seul emplacement de référence ; les autres documents la
  référencent au lieu de la recopier.
- Ne jamais présenter comme existant ce qui est cible, recommandé ou prévu : ces
  informations vivent dans `docs/ARCHITECTURE-TARGET.md`, `docs/ROADMAP.md` ou
  `docs/PROGRESS.md`.
- Ne jamais laisser un document décrire l'ancien comportement après un changement.
