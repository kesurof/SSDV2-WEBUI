# Architecture cible

> **Cible, non implémentée.** Aucun élément de ce document n'existe dans le dépôt à ce
> jour. Conception détaillée : [brief](SSDV2_WEBUI_PROJECT_BRIEF.md) §9, §11, §42-§57.
> Décisions associées : [`DECISIONS.md`](DECISIONS.md). État réel :
> [`ARCHITECTURE-CURRENT.md`](ARCHITECTURE-CURRENT.md).

## Topologie d'exécution

- Une seule image Docker multi-stage (`ghcr.io/projetssd/ssdv2-webui`), un seul conteneur ;
  le frontend compilé est servi par FastAPI, aucun serveur Node en production.
- Montages prévus : socket Docker, dépôt SSDV2 (`SSDV2_SOURCE`), stockage SSDV2
  (`SSDV2_STORAGE`), données WebUI (`WEBUI_DATA`) ; exposition via Traefik.
- Contraintes : `linux/amd64` et `linux/arm64` ; démarrage en mode dégradé si
  Docker/SSDV2/SQLite sont indisponibles, sans crash-loop.

## Frontières et flux

- Navigateur → React → API `/api/v1` → services backend → adaptateurs (`ssdv2ctl`,
  Docker SDK, système de fichiers) → SSDV2 / Docker.
- `ssdv2ctl` (dans le dépôt SSDV2) : frontière non interactive, JSON, commandes
  allowlistées. Les routes HTTP ne contiennent aucune logique SSDV2 ; React ne connaît ni
  bash, ni Ansible, ni CLI Docker, ni chemins internes, ni Vault.

## Propriété des données

- SSDV2 = source de vérité : catalogue `services-available`, `ssddb`, label Docker
  `ssdv2.app`, registres `<app>.containers|.volumes|.dns`, `account.yml`.
- SQLite WebUI = données propres uniquement : users, sessions, jobs, job_events,
  notifications, audit_events, webui_settings, favorites.
- L'état d'une application est un `AppState` agrégé multi-sources, jamais déduit d'une
  source unique.

## Composants backend

- FastAPI + services métier + adaptateurs (découpage du brief §42).
- Jobs : un seul worker de mutation, file en mémoire, état en SQLite, progression SSE ;
  au démarrage, les jobs `running` repassent à `interrupted`.
- Temps réel : SSE (pas de WebSocket au MVP).
- Sécurité : auth admin unique (Argon2id), sessions, CSRF, rate limiting, redaction
  centralisée des secrets, journal d'audit.
