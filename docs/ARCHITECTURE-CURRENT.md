# Architecture actuelle (vérifiée)

> État constaté le **2026-09-17**. Ce document ne décrit que ce qui existe réellement dans
> le dépôt. La cible est dans [`ARCHITECTURE-TARGET.md`](ARCHITECTURE-TARGET.md), la
> conception détaillée dans le [brief](SSDV2_WEBUI_PROJECT_BRIEF.md).

## Contenu réel du dépôt

- `README.md`, `AGENTS.md`, `.gitignore` : documentation et instructions.
- `docs/` : système documentaire (routeur, architecture, décisions, principes de
  développement, roadmap, suivi) et brief de conception.

## Ce qui n'existe pas (à ce jour)

- Aucun code backend ou frontend ; aucun point d'entrée exécutable.
- Aucun manifeste, lockfile ni dépendance installée.
- Aucun test, linter, formateur, typecheck ni commande de build : aucune commande
  vérifiable à documenter.
- Aucun Dockerfile, aucune image, aucun déploiement.
- Aucune CI.

## Versioning

Dépôt initialisé avec Git ; l'historique officiel est celui des commits.

## Contexte externe (non vérifié par ce dépôt)

Le brief décrit SSDV2 tel qu'analysé le 17/09/2026 (catalogue `services-available`,
`ssddb`, registres `<app>.containers|.volumes|.dns`, `account.yml`, `ssdv2ctl` à créer).
Ces éléments vivent dans le dépôt SSDV2, pas ici : ce dépôt ne peut pas les vérifier.
