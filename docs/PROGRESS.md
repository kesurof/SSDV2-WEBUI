# Chantier en cours

> Un seul chantier actif à la fois. Ce document décrit ce qui est en cours, pas l'histoire
> du projet (Git). Un chantier terminé voit sa section supprimée ou réduite à sa
> conclusion ; l'avancement global vit dans [`ROADMAP.md`](ROADMAP.md).

## Chantier actif

**Phase 0 — `ssdv2ctl`, palier lecture seule** (démarré 2026-09-17).

- Code : clone local `~/Developer/ssdv2`, branche `wip/ssdv2ctl` (aucun push — ADR-0010),
  commits `30a0cad0` et suivant.
- Livré : `ssdv2ctl apps list` et `ssdv2ctl app status <app>`, JSON par défaut, erreurs
  structurées sur stderr, codes 0/1/2, allowlist catalogue, contrat documenté (ADR-0011).
- Preuves :
  - 10 tests unittest verts (local en `python:3.13-slim` et serveur en python 3.12) ;
  - validation serveur réelle : 183 entrées de catalogue ; `app status streamfusion` →
    ssddb + registres + 7 conteneurs, 0 alerte (cohérent avec l'API WebUI) ; `wallos` non
    installé ; `app status inconnue` → `unknown_app`, code de sortie 1.

### Suite de la Phase 0 (non commencée)

- Actions non interactives (`app install/remove/reinstall/start/stop/restart`, `auth`,
  `diagnostics`) — à valider sur une application dédiée, jamais sur les apps en service.
- Décider si la WebUI doit consommer `ssdv2ctl` pour certaines lectures (réduirait la
  duplication temporaire du parsing catalogue) — voir ADR-0011.

## Points d'attention détectés

- **GitGuardian** : faux positif « Username Password » sur le commit `a51257c`
  (identifiants de test). Motif supprimé ensuite, occurrence toujours dans l'historique →
  incident `37391944` à ignorer dans le dashboard (exclusion `backend/tests/**` suggérée).
- **Duplication temporaire** : le parsing du catalogue existe dans le backend WebUI et dans
  `ssdv2ctl` (implémentations volontairement alignées) ; à résorber par une décision
  (ADR-0011, suite de la Phase 0).
- **Entrées `ssddb` hors catalogue** : `traefik`, `boostsuitev2` et `appname` (donnée de
  test) ne sont pas listées par la WebUI, pilotée par le catalogue ; à traiter en
  diagnostics (Phase 4).
- `ssdv2ctl` n'est versionné nulle part en ligne tant que l'ADR-0010 s'applique : le clone
  local est la seule copie (sauvegarde ponctuelle conseillée, ex. `git bundle`).
- `~/ssdv2-webui/data/` (vide, appartient à root) est un résidu du premier déploiement en
  bind-mount ; remplacé par le volume nommé `webui-data`.
- Aucune LICENSE dans le dépôt WebUI.
