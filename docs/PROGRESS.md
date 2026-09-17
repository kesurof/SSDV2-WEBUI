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

**Phase 3a — jobs, SSE et actions start/stop/restart**.

- Backend : file de jobs en mémoire + état SQLite (`jobs`, `job_events`), worker unique,
  jobs `running` → `interrupted` au démarrage (ADR-0007) ; `POST /api/v1/apps/{app}/
  start|stop|restart` (202), `GET /api/v1/jobs`, `/jobs/{id}`, `/jobs/{id}/events` (SSE),
  `POST /jobs/{id}/cancel` ; 75 tests pytest verts.
- Frontend : page Jobs (liste + détail avec événements en direct), boutons
  Démarrer/Arrêter/Redémarrer dans le détail d'application avec confirmation et toast
  (Sonner) puis navigation vers le job ; 21 tests Vitest verts.
- Preuves : CI verte ; sur le serveur, `POST /api/v1/apps/dozzle/restart` → job 1
  `app_restart` `queued` puis `success` (code 0) ; événements SSE réels ; `dozzle`
  effectivement redémarré (`Up 3 seconds`) ; `GET /api/v1/jobs` renvoie l'historique.

**Phase 3b — cycle de vie complet (install/remove/reinstall/recreate)**.

- Image : `ansible-core` 2.21.0 + collections/rôles SSDV2, outils CLI (`jq`, `sqlite3`,
  `curl`, `gettext`, `htpasswd`, `pigz`), entrypoint PUID/PGID avec `sudo` interne et
  groupe Docker conservé, inventaire/groupe Vault montés (ADR-0015, ADR-0017) ; ~442 Mo.
- Backend : jobs `app_install`/`app_remove`/`app_reinstall`/`app_recreate` avec paramètres
  (sous-domaine, auth, `delete_data`), micro-migration SQL idempotente (ADR-0016) ;
  85 tests pytest verts.
- Frontend : bouton Installer (dialogue sous-domaine + auth), menu d'actions
  Recréer/Réinstaller/Supprimer avec confirmation graduée (saisie du nom pour la
  suppression des données) ; 23 tests Vitest verts.
- Preuves : CI verte ; sur le serveur, cycle complet en jobs — `remove --delete-data`
  (job 13 `success`), `install` (job 14 `success`, conteneur `wallos` healthy, registres
  + `ssddb` + DNS), `recreate` (job 15 `success`), `remove --delete-data` final (job 16
  `success`) avec nettoyage vérifié (conteneur, registres, `ssddb`, dossier de données,
  DNS `dig @1.1.1.1` vide).

**Phase 4a — diagnostics réparateurs**.

- `ssdv2ctl` : `diagnostics rebuild-registries` (patch officiel de backfill),
  `cleanup-orphan-containers`, `cleanup-dangling-volumes` (43 tests unittest verts).
- Backend : `POST /api/v1/diagnostics/rebuild-registries|cleanup-orphan-containers|
  cleanup-dangling-volumes` en jobs (allowlist adaptateur étendue) ; 87 tests pytest verts.
- Frontend : actions de réparation sur la page Diagnostics, confirmation forte (saisie de
  « SUPPRIMER ») pour les suppressions ; 25 tests Vitest verts.
- Preuves : CI verte ; sur le serveur, `rebuild-registries` (job 19 `success`, 8 registres
  présents), `cleanup-orphan-containers` (job 20 `success`, aucun orphelin) et
  `cleanup-dangling-volumes` (job 21 `success`, 2 volumes → 0, diagnostic à 0).

## Prochains chantiers pressentis

1. Phase 4b : notifications persistantes (+ SSE), audit des actions, backups,
   `ssdv2ctl config`.
2. Polish : confort des logs (recherche, pause), exposition Traefik, multiarch/GHCR.

## Points d'attention détectés

- **GitGuardian** : faux positif « Username Password » sur le commit `a51257c`
  (identifiants de test). Motif supprimé ensuite, occurrence toujours dans l'historique →
  incident `37391944` à ignorer dans le dashboard (exclusion `backend/tests/**` suggérée).
- **Duplication temporaire** : le parsing du catalogue existe dans le backend WebUI et dans
  `ssdv2ctl` ; résorption à trancher (ADR-0011, décision ouverte).
- **Entrées `ssddb` hors catalogue** : `traefik`, `boostsuitev2` et `appname` (donnée de
  test) ne sont pas listées par la WebUI, pilotée par le catalogue ; exposées par
  `diagnostics run` (registres manquants), à traiter en Phase 4.
- **Runtime des mutations** : résolu (ADR-0015/0017) — ansible et outils CLI embarqués,
  conteneur exécuté en PUID/PGID avec `sudo` interne. Maintenir la parité des collections
  avec le serveur lors des mises à jour SSDV2.
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
