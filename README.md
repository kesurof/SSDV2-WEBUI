# SSDV2 WebUI

Interface d'administration Web pour SSDV2 : catalogue d'applications, cycle de vie, jobs,
logs, diagnostics et notifications, au-dessus du moteur SSDV2 existant.

> **Statut : M1 déployé sur le serveur de test.** La tranche lecture seule existe (login
> admin, table des 183 applications, état agrégé Docker/SSDV2) ; les actions de cycle de
> vie, les jobs et l'exposition Traefik restent à faire (voir [`docs/ROADMAP.md`](docs/ROADMAP.md)).

- Point d'entrée documentaire : [`docs/README.md`](docs/README.md)
- Instructions pour les agents IA : [`AGENTS.md`](AGENTS.md)
- Conception détaillée (spécification) : [`docs/SSDV2_WEBUI_PROJECT_BRIEF.md`](docs/SSDV2_WEBUI_PROJECT_BRIEF.md)

Distribution cible : une seule image Docker `ghcr.io/projetssd/ssdv2-webui`
(`linux/amd64`, `linux/arm64`). SSDV2 doit rester fonctionnel sans cette WebUI.
