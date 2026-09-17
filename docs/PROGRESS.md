# Chantier en cours

> Un seul chantier actif à la fois. Ce document décrit ce qui est en cours, pas l'histoire
> du projet (Git). Un chantier terminé voit sa section supprimée ou réduite à sa
> conclusion ; l'avancement global vit dans [`ROADMAP.md`](ROADMAP.md).

## Chantier actif

Aucun.

## Derniers chantiers terminés (2026-09-17)

**Phase 0 — `ssdv2ctl` complet** (clone local `~/Developer/ssdv2`, branche `wip/ssdv2ctl`,
aucun push — ADR-0010 ; dernière révision `444b9681`).

- Livré : `apps list`, `app status`, `app start|stop|restart`, `app install|remove|
  reinstall|recreate`, `auth get|set`, `diagnostics run` — JSON par défaut, erreurs
  structurées, codes 0/1/2 (ADR-0011 à ADR-0013).
- Preuves :
  - 39 tests unittest verts (local `python:3.13-slim` et serveur python 3.12) ;
  - cycle réel complet sur `wallos` : install (23 s) → status → reinstall (auth conservé)
    → `auth set oauth2-proxy` → `recreate` (middleware `chain-oauth2-proxy@file`) →
    `remove --delete-data` ; nettoyage vérifié : conteneur, registres, ligne `ssddb`,
    dossier de données et enregistrement DNS (`dig @1.1.1.1` vide) ;
  - diagnostics réels : registres manquants `appname`/`boostsuitev2`, 0 conteneur
    orphelin, volumes anonymes.

**Branchement WebUI de `ssdv2ctl`** (commit `a91643b`, déployé sur le serveur de test).

- Adaptateur `Ssdv2CtlRunner` (allowlist, `shell=False`, erreurs structurées),
  `SSDV2CTL_PATH`/`SSDV2CTL_TIMEOUT`, health enrichi (`ssdv2ctl: true`), endpoint
  `GET /api/v1/diagnostics` (ADR-0014), compose avec montages Docker CLI + `ssdv2ctl`.
- Preuves : CI verte (`backend`, `frontend`, `docker-build`) ; sur le serveur,
  `{"status":"ok","docker":true,"ssdv2":true,"ssdv2ctl":true,"database":true}` et
  `GET /api/v1/diagnostics` renvoie les contrôles réels ; `GET /api/v1/apps` inchangé
  (183 applications, 8 installées).

**Phase 2 — lecture seule complète (dashboard, détail, logs, diagnostics)**.

- Backend : `GET /api/v1/apps/{app}` (détail), `GET /api/v1/apps/{app}/auth` (via
  `ssdv2ctl auth get`), `GET /api/v1/apps/{app}/logs` (conteneur rattaché, 1-1000 lignes)
  et `/logs/stream` (SSE, suivi en direct), `GET /api/v1/system/summary` (hôte via Docker
  info, branche/commit SSDV2 lus dans `.git`, compteurs) ; 62 tests pytest verts.
- Frontend : `/dashboard` (index), `/apps/:app` (Vue générale avec authentification,
  Conteneurs, Logs avec choix du conteneur, nombre de lignes et suivi en direct SSE,
  Volumes, Réseau/DNS), `/diagnostics` ; 15 tests Vitest verts.
- Preuves : CI verte, déploiement serveur validé — `GET /api/v1/apps/{app}/auth` répond
  `auth: null` pour les applications sans clé `sub.<app>.auth` dans account.yml (aucune
  n'en a aujourd'hui) ; le flux SSE renvoie `{"ready": true}` puis les lignes réelles de
  `streamfusion` ; le dashboard affiche l'hôte et les compteurs réels.

## Prochains chantiers pressentis

1. Phase 3 : jobs + SSE, puis mutations WebUI — dépend de la décision ouverte sur
   l'exécution des mutations depuis le conteneur (runtime ansible/jq, ADR-0014).
   Les actions `start`/`stop`/`restart` et `diagnostics` sont déjà exécutables dans le
   conteneur ; `install`/`remove`/`reinstall`/`recreate` attendent la décision (vault,
   ansible).

## Points d'attention détectés

- **GitGuardian** : faux positif « Username Password » sur le commit `a51257c`
  (identifiants de test). Motif supprimé ensuite, occurrence toujours dans l'historique →
  incident `37391944` à ignorer dans le dashboard (exclusion `backend/tests/**` suggérée).
- **Duplication temporaire** : le parsing du catalogue existe dans le backend WebUI et dans
  `ssdv2ctl` ; résorption à trancher (ADR-0011, décision ouverte).
- **Entrées `ssddb` hors catalogue** : `traefik`, `boostsuitev2` et `appname` (donnée de
  test) ne sont pas listées par la WebUI, pilotée par le catalogue ; exposées par
  `diagnostics run` (registres manquants), à traiter en Phase 4.
- **Runtime des mutations** : le conteneur WebUI n'a ni ansible ni jq ; les mutations
  passeront par `ssdv2ctl` mais nécessiteront une décision d'exécution (ADR-0014).
- **Logs bruts** : les journaux des applications peuvent contenir des secrets
  applicatifs (observé : clés d'API dans des URLs de `streamfusion`) ; l'accès est réservé
  à l'admin authentifié mais aucune redaction n'est appliquée. Une redaction best-effort
  ou l'avertissement explicite dans l'UI reste à décider (Phase 4, sécurité).
- `ssdv2ctl` n'est versionné nulle part en ligne tant que l'ADR-0010 s'applique : le clone
  local est la seule copie (sauvegarde ponctuelle conseillée, ex. `git bundle`).
- Le montage `SSDV2CTL_DIR` pointe vers `~/ssdv2-ctl-dev` (chemin de développement) :
  à remplacer par un emplacement stable avant toute distribution de l'image.
- `~/ssdv2-webui/data/` (vide, appartient à root) est un résidu du premier déploiement en
  bind-mount ; remplacé par le volume nommé `webui-data`.
- Aucune LICENSE dans le dépôt WebUI.
