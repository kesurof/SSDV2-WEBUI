# Roadmap

> Le détail des phases, livrables et critères est dans le [brief](SSDV2_WEBUI_PROJECT_BRIEF.md)
> §63 (phases) et §64 (MVP). Ce tableau ne suit que l'avancement.

| Phase | Contenu | Statut |
|---|---|---|
| Documentation | Système documentaire, ADR initiaux, versioning Git | Terminée — 2026-09-17 |
| 0 — Contrat SSDV2 | `ssdv2ctl` non interactif JSON (apps, app, auth, diagnostics) | À faire (prochain chantier ; développement local uniquement — ADR-0010) |
| 1 — Socle WebUI | FastAPI + React/Vite + shadcn + SQLite + auth admin + image Docker + healthcheck | En cours (reste : exposition Traefik) |
| 2 — Lecture seule | Dashboard, catalogue ~190 apps, filtres, détail app, conteneurs, logs | En cours (liste/filtres/états faits ; reste : dashboard, détail, logs) |
| 3 — Cycle de vie | Jobs, SSE, install/start/stop/restart/reinstall/remove, confirmations | À faire |
| 4 — Administration | Auth en masse, configuration, notifications persistantes, audit, backups, diagnostics | À faire |
| 5 — Avancé | Mise à jour SSDV2, Git, patches, Docker avancé, fonctions hôte | À faire |

Le MVP utile correspond aux points listés dans le brief §64 ; il couvre les phases 1 à 4.
Statuts possibles : à faire / en cours / terminée / abandonnée. Toute évolution de statut se
répercute ici et dans [`PROGRESS.md`](PROGRESS.md).
