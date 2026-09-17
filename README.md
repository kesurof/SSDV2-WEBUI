# SSDV2 WebUI

Interface d'administration Web pour SSDV2 : catalogue des applications, cycle de vie
(installer, démarrer, arrêter, redémarrer, recréer, réinstaller, supprimer, sauvegarder),
jobs et logs temps réel, diagnostics, notifications, audit et paramètres, au-dessus du
moteur SSDV2 existant.

> **Statut** : phases 1 à 4 livrées et validées sur le serveur de test (auth admin,
> lecture seule, cycle de vie complet en jobs, administration). Reste : Phase 5
> (mise à jour SSDV2, Docker avancé, fonctions hôte) — voir [`docs/ROADMAP.md`](docs/ROADMAP.md).

- Point d'entrée documentaire : [`docs/README.md`](docs/README.md)
- Instructions pour les agents IA : [`AGENTS.md`](AGENTS.md)
- Conception détaillée (spécification) : [`docs/SSDV2_WEBUI_PROJECT_BRIEF.md`](docs/SSDV2_WEBUI_PROJECT_BRIEF.md)

## Installation

Au premier démarrage, deux chemins :

1. **Assistant** (recommandé) : sans `WEBUI_ADMIN_PASSWORD`, ouvrir `/setup` et saisir le
   jeton d'installation affiché dans les journaux du conteneur
   (`docker logs ssdv2-webui | grep -i jeton`) ou lu dans `./data/setup-token`.
2. **Automatisation** : fournir `WEBUI_ADMIN_USER` / `WEBUI_ADMIN_PASSWORD` au premier
   démarrage ; le compte est créé et l'assistant désactivé.

Image publiée : `ghcr.io/kesurof/ssdv2-webui` (`linux/amd64`, `linux/arm64`). SSDV2 reste
fonctionnel sans cette WebUI.
