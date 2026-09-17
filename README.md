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

### Application SSDV2 (déploiement de référence)

La WebUI s'installe comme n'importe quelle application SSDV2 (menu « Installer
Application » ou `ssdv2ctl app install ssdv2webui`) : image publique multiarchitecture,
labels Traefik et choix d'authentification générés par SSDV2, données sous le stockage
SSDV2, cycle de vie (recréer, sauvegarder, supprimer) géré par l'outillage existant.
Détails : [`docs/ARCHITECTURE-CURRENT.md`](docs/ARCHITECTURE-CURRENT.md).

### Développement local (compose)

```sh
cp .env.example .env   # renseigner SSDV2_USER, SSDV2_UID, SSDV2_GID, DOCKER_GID
docker compose up -d --build
```

Au premier démarrage, deux chemins :

1. **Assistant** (recommandé) : sans `WEBUI_ADMIN_PASSWORD`, ouvrir `/setup` et saisir le
   jeton d'installation affiché dans les journaux du conteneur
   (`docker logs ssdv2-webui | grep -i jeton`) ou lu dans le volume de données.
2. **Automatisation** : fournir `WEBUI_ADMIN_USER` / `WEBUI_ADMIN_PASSWORD` au premier
   démarrage ; le compte est créé et l'assistant désactivé.

Image publiée : `ghcr.io/kesurof/ssdv2-webui` (`linux/amd64`, `linux/arm64`). SSDV2 reste
fonctionnel sans cette WebUI.

## Licence

GPL-3.0 — voir [`LICENSE`](LICENSE).
