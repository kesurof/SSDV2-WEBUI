# Chantier en cours

> Un seul chantier actif à la fois. Ce document décrit ce qui est en cours, pas l'histoire
> du projet (Git). Un chantier terminé voit sa section supprimée ou réduite à sa
> conclusion ; l'avancement global vit dans [`ROADMAP.md`](ROADMAP.md).

## Chantier actif

**Phase 0 — `ssdv2ctl`** (démarré 2026-09-17).

- Code : clone local `~/Developer/ssdv2`, branche `wip/ssdv2ctl` (aucun push — ADR-0010),
  dernière révision `18e82c17`.
- Livré :
  - lecture seule : `apps list`, `app status` (ADR-0011) ;
  - actions : `app start|stop|restart` sur les conteneurs existants (ADR-0012).
- Preuves :
  - 16 tests unittest verts (local en `python:3.13-slim` et serveur en python 3.12) ;
  - validation serveur : 183 entrées de catalogue ; `streamfusion` → 7 conteneurs ;
    cycle réel sur `dozzle` : `stop` → `Exited (0)`, `start` → `Up`, `restart` → `Up`,
    status final `running` ;
  - erreurs structurées vérifiées : `unknown_app`, `no_containers`,
    `docker_unavailable` (code 1, stdout vide).

### Suite de la Phase 0 (non commencée)

- Actions restantes : install, remove, reinstall/recréer (« relance » SSDV2), auth,
  diagnostics — validation uniquement sur une application dédiée.
- Décider si la WebUI consomme `ssdv2ctl` pour certaines lectures (réduirait la
  duplication temporaire du parsing catalogue) ; branchement de l'adaptateur
  (`SSDV2CTL_PATH`) pour la Phase 3.

## Points d'attention détectés

- **GitGuardian** : faux positif « Username Password » sur le commit `a51257c`
  (identifiants de test). Motif supprimé ensuite, occurrence toujours dans l'historique →
  incident `37391944` à ignorer dans le dashboard (exclusion `backend/tests/**` suggérée).
- **Duplication temporaire** : le parsing du catalogue existe dans le backend WebUI et dans
  `ssdv2ctl` (implémentations volontairement alignées) ; à résorber par une décision
  (suite de la Phase 0).
- **Entrées `ssddb` hors catalogue** : `traefik`, `boostsuitev2` et `appname` (donnée de
  test) ne sont pas listées par la WebUI, pilotée par le catalogue ; à traiter en
  diagnostics (Phase 4).
- `ssdv2ctl` n'est versionné nulle part en ligne tant que l'ADR-0010 s'applique : le clone
  local est la seule copie (sauvegarde ponctuelle conseillée, ex. `git bundle`).
- `~/ssdv2-webui/data/` (vide, appartient à root) est un résidu du premier déploiement en
  bind-mount ; remplacé par le volume nommé `webui-data`.
- Aucune LICENSE dans le dépôt WebUI.
