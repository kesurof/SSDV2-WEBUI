# Documentation — SSDV2 WebUI

Routeur documentaire : indique où faire autorité chaque type d'information. Ce fichier ne
recopie aucun contenu ; il oriente vers le document de référence.

## Où chercher

| Sujet | Document de référence |
|---|---|
| État actuel vérifié du dépôt | [`ARCHITECTURE-CURRENT.md`](ARCHITECTURE-CURRENT.md) |
| Cible architecturale (non implémentée) | [`ARCHITECTURE-TARGET.md`](ARCHITECTURE-TARGET.md) |
| Conception détaillée / spécification source | [`SSDV2_WEBUI_PROJECT_BRIEF.md`](SSDV2_WEBUI_PROJECT_BRIEF.md) |
| Maquette de référence UI (design) | [`SSDV2_WEBUI_MOCKUP_FINAL_UI.html`](SSDV2_WEBUI_MOCKUP_FINAL_UI.html) |
| Décisions architecturales (ADR) | [`DECISIONS.md`](DECISIONS.md) |
| Roadmap et phases | [`ROADMAP.md`](ROADMAP.md) |
| Chantier en cours | [`PROGRESS.md`](PROGRESS.md) |
| Règles permanentes de conception et de développement (réutilisation, code maison, dépendances, sources de vérité, preuve, synchronisation) | [`DEVELOPMENT-PRINCIPLES.md`](DEVELOPMENT-PRINCIPLES.md) |
| Rappels opérationnels spécifiques au dépôt | [`../AGENTS.md`](../AGENTS.md) (règles 1-10) |
| Instructions agents IA | [`../AGENTS.md`](../AGENTS.md) |
| Historique détaillé | Git (commits) |

## Règles du système documentaire

1. **Une information, un seul emplacement de référence.** Les autres documents la
   référencent (lien + section) au lieu de la recopier.
2. **État ≠ cible.** `ARCHITECTURE-CURRENT.md` ne contient que des faits vérifiés dans le
   dépôt. Toute information future va dans `ARCHITECTURE-TARGET.md`, `ROADMAP.md` ou
   `PROGRESS.md`.
3. **Décision durable → ADR**, selon le processus décrit dans `DECISIONS.md`.
4. **Histoire → Git.** `PROGRESS.md` et `ROADMAP.md` ne servent pas de journal de commits.
5. **Synchronisation obligatoire** : voir principes §18 dans
   [`DEVELOPMENT-PRINCIPLES.md`](DEVELOPMENT-PRINCIPLES.md) ; rappel dans
   [`../AGENTS.md`](../AGENTS.md).
