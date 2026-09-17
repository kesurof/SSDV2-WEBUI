# Chantier en cours

> Un seul chantier actif à la fois. Ce document décrit ce qui est en cours, pas l'histoire
> du projet (Git). Un chantier terminé voit sa section supprimée ou réduite à sa
> conclusion ; l'avancement global vit dans [`ROADMAP.md`](ROADMAP.md).

## Chantier actif

Aucun.

## Dernier chantier terminé

**M1 — socle et lecture seule** (2026-09-17, commit `950dd5b`, branche
`feat/m1-lecture-seule`, PR #1).

Preuves :

- CI verte sur le runner self-hosted : backend (ruff + 25 tests), frontend (oxlint, tsc,
  5 tests Vitest, build), `docker build`.
- Déploiement serveur de test (`~/ssdv2-webui`, compose) : `/health` =
  `{"status":"ok","docker":true,"ssdv2":true,"database":true}` ; `GET /api/v1/apps` =
  183 applications, 8 installées, 8 en marche, 0 alerte ; URLs dérivées du domaine
  (`https://prowlarr.2000851.xyz`).
- Mode dégradé vérifié : base indisponible et Docker/SSDV2 absents → démarrage sans
  crash-loop, health `degraded`, bandeau UI.

## Prochain chantier pressenti

Phase 0 — contrat `ssdv2ctl` (non commencé ; obligatoire avant toute mutation).
Contrainte : développement **local uniquement**, aucune branche ni PR sur
`projetssd/ssdv2` tant que le projet n'est pas finalisé (ADR-0010). Voir
[`ROADMAP.md`](ROADMAP.md).

## Points d'attention détectés

- **GitGuardian** : faux positif « Username Password » sur le commit `a51257c`
  (identifiants de test). Le motif a été supprimé ensuite, mais l'occurrence reste dans
  l'historique de la branche → incident `37391944` à ignorer dans le dashboard
  GitGuardian (et exclusion `backend/tests/**` suggérée). Le check reste rouge sur PR #1.
- **Entrées `ssddb` hors catalogue** : `traefik`, `boostsuitev2` et `appname` (donnée de
  test) ne sont pas listées par la WebUI, qui est pilotée par le catalogue ; à traiter en
  diagnostics (Phase 4).
- `~/ssdv2-webui/data/` (vide, appartient à root) est un résidu du premier déploiement en
  bind-mount ; remplacé par le volume nommé `webui-data`.
- Aucune LICENSE dans le dépôt.
