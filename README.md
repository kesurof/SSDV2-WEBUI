# SSDV2 WebUI

Interface d'administration Web pour SSDV2 : catalogue d'applications, cycle de vie, jobs,
logs, diagnostics et notifications, au-dessus du moteur SSDV2 existant.

> **Statut : conception.** Aucun code n'existe encore dans ce dépôt. La cible et la
> roadmap sont décrites dans la documentation ci-dessous et ne sont pas implémentées.

- Point d'entrée documentaire : [`docs/README.md`](docs/README.md)
- Conception détaillée (spécification) : [`docs/SSDV2_WEBUI_PROJECT_BRIEF.md`](docs/SSDV2_WEBUI_PROJECT_BRIEF.md)
- Instructions pour les agents IA : [`AGENTS.md`](AGENTS.md)

Distribution cible : une seule image Docker `ghcr.io/projetssd/ssdv2-webui`
(`linux/amd64`, `linux/arm64`). SSDV2 doit rester fonctionnel sans cette WebUI.
