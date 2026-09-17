# SSDV2 WebUI — Brief complet de conception et d’implémentation

> **Document de référence destiné à une IA de développement**
>
> État du projet analysé : **17 septembre 2026**  
> Dépôt SSDV2 : https://github.com/projetssd/ssdv2  
> Objectif : concevoir une **nouvelle WebUI moderne, optionnelle et indépendante de l’ancienne WebUI**.

---

## 1. Résumé exécutif

SSDV2 est un projet d’automatisation/self-hosting basé principalement sur **Bash, Ansible, Docker, Traefik, SQLite et des fichiers YAML**.

Le projet permet d’installer et de gérer environ **190 applications Docker** depuis un serveur Linux. La logique métier existe déjà dans SSDV2 : catalogue d’applications, variables, pre-tasks, post-tasks, installation, suppression, registres de conteneurs/volumes/DNS, gestion d’authentification, sauvegardes, diagnostics, Cloudflare, Traefik, etc.

Le besoin est de créer **une nouvelle interface Web d’administration**, à partir de zéro.

### Contraintes fondamentales

La nouvelle WebUI :

- **ne doit réutiliser aucun code de l’ancienne WebUI** ;
- doit être un **projet indépendant** ;
- doit être distribuée sous la forme d’**une seule image Docker** ;
- doit être **totalement optionnelle** : SSDV2 doit continuer à fonctionner sans elle ;
- doit gérer un catalogue d’environ **190 applications** ;
- doit être pensée comme une vraie **interface d’administration dense**, pas comme une simple galerie de cartes ;
- doit gérer beaucoup de :
  - tableaux ;
  - filtres ;
  - menus d’actions ;
  - formulaires ;
  - opérations en masse ;
  - confirmations ;
  - jobs longs ;
  - logs temps réel ;
  - notifications ;
  - diagnostics ;
- doit être **simple et rapide à développer avec du vibe coding / coding agent** ;
- doit rester facile à maintenir ;
- doit fonctionner sur **AMD64 et ARM64** ;
- doit éviter les dépendances d’infrastructure inutiles.

### Stack recommandée

#### Frontend

- React
- TypeScript
- Vite
- shadcn/ui
- Tailwind CSS
- TanStack Table
- TanStack Query
- React Router
- React Hook Form
- Zod
- Sonner pour les toasts/notifications
- Lucide Icons

#### Backend

- Python 3.13
- FastAPI
- Pydantic
- Docker SDK for Python
- SQLite
- SQLAlchemy 2 ou SQLModel
- SSE pour les événements temps réel
- subprocess contrôlé pour l’intégration SSDV2

#### Production

Une seule image Docker multi-stage :

1. Node construit le frontend React.
2. L’image Python finale contient :
   - FastAPI ;
   - le frontend compilé ;
   - le runtime nécessaire ;
   - aucun serveur Node en production.

Architecture logique :

```text
Navigateur
    │
    ▼
Traefik
    │
    ▼
┌───────────────────────────────────────────┐
│        ghcr.io/projetssd/ssdv2-webui     │
│                                           │
│  React / TypeScript / shadcn              │
│                  │                        │
│                  ▼                        │
│              FastAPI                      │
│                  │                        │
│      ┌───────────┼───────────┐            │
│      ▼           ▼           ▼            │
│   SQLite     Docker SDK   SSDV2 Adapter   │
│                              │            │
│                           ssdv2ctl        │
└───────────────────────────────────────────┘
       │                 │
       ▼                 ▼
 Docker socket       fichiers SSDV2
```

---

# 2. Important : ancienne WebUI

SSDV2 possède actuellement une WebUI.

Elle utilise notamment plusieurs composants/images :

- `ssd-frontend`
- `ssd-backend`
- `saison-frontend`

La nouvelle WebUI doit **remplacer conceptuellement cette solution**, mais :

> **aucun code, aucune architecture et aucune dépendance fonctionnelle de l’ancienne WebUI ne doivent être repris par défaut.**

La nouvelle WebUI doit pouvoir être développée dans un dépôt distinct, par exemple :

```text
projetssd/ssdv2-webui
```

et publiée comme :

```text
ghcr.io/projetssd/ssdv2-webui:latest
```

L’ancienne WebUI doit être considérée uniquement comme une source éventuelle d’informations fonctionnelles sur ce qui avait été tenté, jamais comme une base technique à conserver.

---

# 3. Environnement actuel SSDV2

## 3.1 Technologies principales

SSDV2 utilise actuellement principalement :

- Linux ;
- Bash ;
- Python ;
- Ansible ;
- Docker ;
- Docker Compose dans certains composants ;
- Traefik ;
- Cloudflare ;
- SQLite ;
- YAML ;
- Ansible Vault ;
- Git.

Le dépôt principal est généralement présent dans :

```text
~/seedbox-compose
```

Cette valeur correspond habituellement à :

```text
SETTINGS_SOURCE
```

Le stockage SSDV2 est généralement présent dans :

```text
~/seedbox
```

Cette valeur correspond habituellement à :

```text
SETTINGS_STORAGE
```

Ces chemins doivent rester configurables.

---

# 4. Sources de vérité existantes

La nouvelle WebUI ne doit pas créer inutilement une deuxième base de vérité.

Elle doit exploiter les informations déjà disponibles dans SSDV2.

## 4.1 Catalogue des applications

Liste actuelle :

```text
includes/config/services-available
```

Le fichier contient les applications disponibles sous une forme proche de :

```text
sonarr - Gestion Séries Usenet et BitTorrent
radarr - Gestion Films Usenet-BitTorrent
prowlarr - Indexeur de scraping
...
```

Il représente environ **190 applications** et continuera probablement à évoluer.

---

## 4.2 Variables d’application

Les définitions sont principalement situées dans :

```text
includes/dockerapps/vars/
```

Exemple :

```text
includes/dockerapps/vars/sonarr.yml
```

Ces fichiers décrivent notamment :

- image Docker ;
- volumes ;
- variables d’environnement ;
- ports ;
- paramètres Traefik ;
- réseau ;
- pre-tasks ;
- post-tasks ;
- paramètres Docker spécifiques.

---

## 4.3 Déploiement générique

Le cycle de déploiement générique SSDV2 repose sur un playbook qui :

1. capture l’état Docker avant installation ;
2. exécute les pre-tasks ;
3. crée les dossiers ;
4. configure éventuellement Cloudflare/DNS ;
5. génère les labels Traefik ;
6. déploie le ou les conteneurs ;
7. exécute les post-tasks ;
8. recense les conteneurs ;
9. recense les volumes ;
10. écrit les registres ;
11. enregistre l’application dans SQLite.

Le label Docker suivant est particulièrement important :

```text
ssdv2.app=<nom_application>
```

Exemple :

```text
ssdv2.app=sonarr
```

Ce label doit devenir une source majeure pour la nouvelle WebUI.

---

# 5. Registres SSDV2 par application

SSDV2 conserve plusieurs registres dans :

```text
~/seedbox/conf/
```

Pour une application donnée :

```text
<app>.containers
<app>.volumes
<app>.dns
```

Exemple :

```text
~/seedbox/conf/sonarr.containers
~/seedbox/conf/sonarr.volumes
~/seedbox/conf/sonarr.dns
```

Ces fichiers indiquent respectivement :

- les conteneurs associés ;
- les volumes associés ;
- les DNS associés.

Ils doivent être utilisés pour les vues détaillées, diagnostics et suppressions.

---

# 6. Base SQLite SSDV2

SSDV2 possède actuellement une base :

```text
ssddb
```

Elle contient notamment les applications installées.

Le déploiement générique y enregistre des informations telles que :

```text
name
status
subdomain
port
```

Cette base reste une source SSDV2.

La nouvelle WebUI doit avoir **sa propre SQLite**, distincte, uniquement pour ses données propres.

---

# 7. Configuration utilisateur SSDV2

Une partie importante de la configuration est stockée dans :

```text
account.yml
```

Ce fichier contient potentiellement des secrets et utilise **Ansible Vault**.

Les mécanismes SSDV2 existants comprennent notamment :

```text
get_from_account_yml
manage_account_yml
```

Un cache temporaire déchiffré peut être créé :

```text
~/seedbox/.account.cache.json
```

Il doit être considéré comme **sensible**.

La WebUI :

- ne doit jamais afficher un secret brut sans action volontaire ;
- ne doit jamais enregistrer les secrets dans ses logs ;
- ne doit jamais copier tous les secrets dans sa propre SQLite ;
- doit réutiliser les mécanismes SSDV2 de lecture/écriture lorsque possible.

---

# 8. Cycle de vie actuel d’une application

SSDV2 expose actuellement des concepts tels que :

```text
launch_service <app>
suppression_appli <app>
```

et des actions de :

- installation ;
- suppression ;
- suppression avec conservation des données ;
- réinitialisation ;
- recréation ;
- modification d’authentification ;
- déploiement des pre/post-tasks ;
- mise à jour des registres.

La nouvelle WebUI ne doit pas reconstruire arbitrairement toute cette logique dans React ou dans des endpoints FastAPI.

---

# 9. Couche de contrôle recommandée : `ssdv2ctl`

Afin d’éviter de coupler la nouvelle WebUI directement à des dizaines de fonctions Bash interactives, il est fortement recommandé de créer dans le cœur SSDV2 une petite interface stable et non interactive :

```text
ssdv2ctl
```

Exemples souhaités :

```bash
ssdv2ctl apps list --json
ssdv2ctl app status sonarr --json

ssdv2ctl app install sonarr
ssdv2ctl app remove sonarr
ssdv2ctl app remove sonarr --keep-data
ssdv2ctl app reinstall sonarr

ssdv2ctl app start sonarr
ssdv2ctl app stop sonarr
ssdv2ctl app restart sonarr

ssdv2ctl app logs sonarr

ssdv2ctl auth list --json
ssdv2ctl auth set sonarr authelia

ssdv2ctl diagnostics run --json

ssdv2ctl config get settings.domain --json
ssdv2ctl config set settings.domain example.com
```

Objectif :

```text
SSDV2 Core
   │
   ├── Bash / Ansible / Docker / YAML
   │
   └── ssdv2ctl
          │
          ├── CLI existante / future
          └── nouvelle WebUI
```

`ssdv2ctl` doit :

- être non interactif ;
- retourner des codes de sortie cohérents ;
- proposer une sortie JSON ;
- accepter uniquement des commandes explicitement supportées ;
- ne jamais accepter une commande shell arbitraire ;
- être testable ;
- devenir la frontière stable entre les interfaces et SSDV2.

---

# 10. Particularité importante : WebUI exécutée dans Docker

La WebUI est un conteneur.

Elle n’est donc **pas l’hôte Linux**.

Les scripts existants qui utilisent :

```text
localhost
systemd
apt
ufw
/etc
mount
kernel
users/groups
```

ne doivent pas être exécutés naïvement depuis le conteneur en pensant modifier l’hôte.

Il faut distinguer deux types d’opérations.

## Type A — compatibles avec la WebUI conteneurisée

Exemples :

- lecture du catalogue SSDV2 ;
- lecture/écriture dans les dossiers SSDV2 montés ;
- gestion Docker via `/var/run/docker.sock` ;
- démarrage/arrêt/restart des conteneurs ;
- logs Docker ;
- inspection Docker ;
- labels ;
- réseaux Docker ;
- volumes Docker ;
- DNS Cloudflare via API ;
- gestion des paramètres applicatifs ;
- authentification applicative ;
- opérations Ansible qui ne dépendent pas directement du namespace système hôte.

## Type B — opérations hôte sensibles

Exemples :

- UFW ;
- iptables ;
- paquets APT ;
- systemd ;
- utilisateurs Linux ;
- kernel ;
- certains montages ;
- configuration réseau de l’hôte ;
- changements système sous `/etc`.

Ces fonctionnalités ne doivent pas être bricolées avec :

```text
--privileged
/:/host
nsenter
```

sans décision architecturale explicite.

Pour le MVP, les opérations Type B peuvent rester dans la CLI SSDV2.

Une évolution ultérieure pourrait introduire un **agent hôte SSDV2 sécurisé**, mais ce n’est pas nécessaire au démarrage.

---

# 11. Déploiement Docker de la nouvelle WebUI

L’objectif est :

```text
1 image
1 conteneur
0 PostgreSQL
0 Redis
0 Celery
0 serveur Node en production
```

Exemple conceptuel :

```yaml
services:
  ssdv2-webui:
    image: ghcr.io/projetssd/ssdv2-webui:latest
    container_name: ssdv2-webui
    restart: unless-stopped

    environment:
      SSD_USER: "${USER}"
      SSDV2_SOURCE: "/home/${USER}/seedbox-compose"
      SSDV2_STORAGE: "/home/${USER}/seedbox"
      WEBUI_DATA: "/data"
      TZ: "Europe/Paris"

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

      - /home/${USER}/seedbox-compose:/home/${USER}/seedbox-compose
      - /home/${USER}/seedbox:/home/${USER}/seedbox

      - ./data:/data

    networks:
      - traefik_proxy
```

Les montages exacts devront être adaptés au fonctionnement de `ssdv2ctl`.

L’objectif reste de limiter les montages au strict nécessaire.

---

# 12. Sécurité Docker

Le montage :

```text
/var/run/docker.sock
```

donne pratiquement un contrôle root de l’hôte.

La WebUI doit donc être considérée comme une application **hautement privilégiée**.

Conséquences :

- aucune route publique non authentifiée ;
- aucune exécution de commande shell libre ;
- validation stricte de tous les paramètres ;
- noms d’applications obligatoirement issus du catalogue SSDV2 ;
- actions destructrices confirmées ;
- secrets masqués ;
- logs nettoyés ;
- session sécurisée ;
- protection CSRF si authentification par cookie ;
- `SameSite`, `Secure`, `HttpOnly` sur les cookies ;
- rate limiting minimal sur login/actions sensibles ;
- journal d’audit ;
- pas de terminal shell Web arbitraire dans le MVP.

---

# 13. Authentification de la WebUI elle-même

La WebUI contrôle Docker et SSDV2.

Elle ne doit donc jamais fonctionner en accès anonyme par défaut.

Approche MVP recommandée :

- compte administrateur local unique ;
- mot de passe hashé avec Argon2id ;
- session serveur ou cookie signé ;
- possibilité future de déléguer l’authentification à :
  - Authelia ;
  - OAuth2 Proxy ;
  - Traefik ForwardAuth.

La prise en charge d’un proxy d’authentification peut être ajoutée ensuite.

---

# 14. Stack frontend détaillée

## React + TypeScript + Vite

Pourquoi :

- développement rapide ;
- excellent support des coding agents ;
- écosystème très mature ;
- adapté aux interfaces admin riches ;
- séparation claire frontend/backend ;
- build simple.

## shadcn/ui

Utiliser shadcn pour :

- boutons ;
- dropdown menus ;
- modales ;
- alert dialogs ;
- sheets ;
- tabs ;
- badges ;
- popovers ;
- tooltips ;
- formulaires ;
- command palette ;
- navigation ;
- sidebar ;
- cards ponctuelles ;
- skeletons.

Ne pas construire manuellement des composants déjà standardisés.

## TanStack Table

Composant essentiel.

La WebUI aura énormément de tableaux.

Fonctions nécessaires :

- tri ;
- filtres ;
- recherche ;
- colonnes masquables ;
- sélection multiple ;
- actions par ligne ;
- actions groupées ;
- pagination si nécessaire ;
- sticky headers ;
- badges d’état ;
- menus contextuels.

Avec environ 190 applications, la table des applications peut être chargée côté client.

## TanStack Query

Utiliser pour :

- cache API ;
- invalidation ;
- polling léger lorsque nécessaire ;
- mutations ;
- états loading/error ;
- synchronisation des vues.

## React Hook Form + Zod

Pour :

- formulaires ;
- validation ;
- formulaires dynamiques par application ;
- paramètres ;
- configuration auth ;
- secrets.

## Sonner

Pour les notifications immédiates :

```text
✓ Sonarr redémarré
✓ Installation terminée
⚠ Mise à jour disponible
✗ Échec de suppression
```

Les toasts ne remplacent pas le centre de notifications persistant.

---

# 15. UX générale

La WebUI doit ressembler davantage à :

- Portainer ;
- Coolify ;
- Proxmox ;
- Unraid ;
- TrueNAS ;

qu’à une galerie d’applications grand public.

Priorité :

> **densité d’information + vitesse d’action + lisibilité**

La WebUI doit être principalement pensée pour desktop, tout en restant utilisable sur tablette/mobile.

---

# 16. Navigation principale proposée

Sidebar :

```text
Dashboard

Applications
Jobs
Notifications

Sauvegardes
Diagnostics

Docker
Réseau / Proxy

Paramètres
À propos / SSDV2
```

Des sections peuvent être masquées tant qu’elles ne sont pas implémentées.

---

# 17. Dashboard

Le dashboard doit synthétiser l’état du serveur et de SSDV2.

## Résumé serveur

Afficher :

- hostname ;
- OS ;
- kernel ;
- uptime ;
- architecture ;
- CPU ;
- RAM ;
- swap ;
- espace disque ;
- charge système.

## Résumé SSDV2

Afficher :

- version ;
- branche Git ;
- commit courant ;
- mise à jour disponible ;
- nombre d’applications installées ;
- nombre d’applications démarrées ;
- nombre d’applications arrêtées ;
- nombre d’applications en erreur ;
- nombre total d’applications disponibles ;
- derniers jobs ;
- derniers événements importants.

## Alertes

Exemples :

```text
3 conteneurs arrêtés
2 registres SSDV2 manquants
1 mise à jour SSDV2 disponible
4 volumes orphelins
Échec du dernier backup
```

---

# 18. Page Applications — écran principal

Avec environ 190 applications, l’élément principal doit être une **DataTable**.

Pas une grille de 190 cartes comme vue principale.

Exemple :

```text
Applications (190)

[Recherche........................] [Installées ▼] [Catégorie ▼] [Auth ▼]

☑ │ Application │ État │ Auth     │ Domaine       │ Image/Version │ Actions
──┼─────────────┼──────┼──────────┼───────────────┼───────────────┼────────
□ │ Sonarr      │ ● OK │ Authelia │ sonarr.xxx.fr │ linuxserver.. │ •••
□ │ Radarr      │ ● OK │ OAuth    │ radarr.xxx.fr │ linuxserver.. │ •••
□ │ Prowlarr    │ ○ OFF│ Authelia │ prowlarr...   │ linuxserver.. │ •••
□ │ Coolify     │ ● OK │ Aucune   │ coolify...    │ coollabsio..  │ •••
□ │ Wallos      │ --   │ --       │ --            │ --            │ Installer
```

---

# 19. Filtres Applications

Prévoir au minimum :

- recherche texte ;
- installé / non installé ;
- running / stopped / unhealthy ;
- authentification ;
- catégorie ;
- tags ;
- applications avec mise à jour éventuelle ;
- applications avec erreur ;
- favoris éventuels.

Recherche :

- nom ;
- description ;
- tags ;
- image ;
- domaine.

---

# 20. Catalogue enrichi

`services-available` ne contient aujourd’hui qu’un nom + une courte description.

Pour une WebUI moderne, ajouter éventuellement un fichier de **métadonnées purement visuelles**, sans logique de déploiement.

Exemple :

```yaml
sonarr:
  display_name: Sonarr
  category: media
  description: Gestionnaire de séries
  icon: sonarr.svg
  website: https://sonarr.tv
  tags:
    - media
    - arr
    - series
```

Ce fichier ne doit pas devenir une nouvelle source de vérité pour :

- l’image Docker ;
- les volumes ;
- les ports ;
- les variables ;
- l’installation.

Il ne contient que les métadonnées d’interface.

Toutes les applications doivent fonctionner même si ces métadonnées sont absentes.

---

# 21. Actions d’une application

Menu `•••` proposé :

```text
Ouvrir l'application
Voir les détails
Voir les logs

Démarrer
Arrêter
Redémarrer

Recréer
Réinstaller

Modifier l'authentification
Modifier la configuration

Sauvegarder

Supprimer
```

Les actions impossibles selon l’état doivent être désactivées.

Exemple :

- une application non installée propose `Installer` ;
- une application arrêtée ne propose pas `Arrêter` ;
- une application non installée ne propose pas `Logs`.

---

# 22. Actions groupées

La sélection de plusieurs applications doit permettre :

```text
Redémarrer
Arrêter
Démarrer

Changer authentification
Recréer

Supprimer
```

Chaque action groupée doit afficher :

- nombre d’applications concernées ;
- résumé ;
- confirmation ;
- résultat individuel par application.

---

# 23. Détail d’une application

Route :

```text
/apps/:app
```

Onglets possibles :

```text
Vue générale
Conteneurs
Logs
Configuration
Volumes
Réseau / DNS
Historique
```

## Vue générale

Afficher :

- nom ;
- description ;
- statut ;
- URL ;
- auth ;
- image ;
- version/image ID ;
- uptime ;
- restart count ;
- CPU/RAM ;
- date installation approximative ;
- dernier événement ;
- commandes principales.

---

# 24. Conteneurs d’une application

Utiliser en priorité :

```text
label ssdv2.app=<app>
```

et compléter avec :

```text
<app>.containers
```

Afficher :

- nom ;
- image ;
- statut ;
- health ;
- uptime ;
- ports ;
- réseau ;
- IP ;
- restart count.

Actions :

- logs ;
- start ;
- stop ;
- restart ;
- inspect.

Ne pas exposer une modification arbitraire de Docker Inspect dans le MVP.

---

# 25. Logs

Fonctions :

- logs temps réel ;
- recherche texte ;
- pause ;
- auto-scroll ;
- choix du conteneur ;
- nombre de lignes ;
- timestamps ;
- téléchargement éventuel plus tard.

Pour les logs live, WebSocket n’est pas nécessaire au départ.

SSE ou streaming HTTP suffit.

---

# 26. Authentification des applications

SSDV2 gère actuellement plusieurs méthodes :

```text
basique
oauth
authelia
aucune
oauth2-proxy
```

La WebUI doit proposer :

- affichage de l’auth actuelle ;
- modification par application ;
- modification en masse ;
- aperçu avant application ;
- confirmation ;
- reconfiguration/recréation si nécessaire.

Exemple tableau :

```text
☑ Sonarr      Authelia
☑ Radarr      Authelia
☑ Prowlarr    Basic
```

Action :

```text
Changer les 3 applications vers : OAuth2 Proxy
```

---

# 27. Jobs / opérations longues

L’installation d’une application ne doit jamais bloquer une requête HTTP jusqu’à la fin.

Chaque opération longue devient un **Job**.

Exemples :

```text
install_app
remove_app
reinstall_app
update_auth
backup
restore
diagnostics
git_update
```

Chaque job possède :

```text
id
type
target
status
created_at
started_at
finished_at
progress
result
error
```

États :

```text
queued
running
success
failed
cancelled
interrupted
```

---

# 28. Queue de jobs

Pour le MVP :

- utiliser une queue en mémoire ;
- conserver l’état dans SQLite ;
- lancer **un seul worker de mutation** ;
- ne pas utiliser Redis ;
- ne pas utiliser Celery.

Pourquoi un seul worker :

SSDV2 modifie des ressources globales :

- Docker ;
- account.yml ;
- DNS ;
- registres ;
- fichiers de configuration.

Lancer plusieurs installations/suppressions simultanément peut provoquer des conflits.

On pourra permettre plus tard certaines opérations parallèles explicitement sûres.

Au démarrage de la WebUI :

- tout job encore `running` doit passer à `interrupted`.

---

# 29. Logs des jobs

Chaque job doit produire des événements.

Exemple :

```text
09:22:14 Job démarré
09:22:15 Lecture configuration Sonarr
09:22:15 Vérification DNS
09:22:17 Pull image Docker
09:22:29 Création du conteneur
09:22:31 Exécution post-task
09:22:33 Registre conteneurs mis à jour
09:22:33 Installation terminée
```

Ces événements doivent être :

- affichés en temps réel ;
- conservés en SQLite avec une rétention raisonnable ;
- filtrés pour ne jamais contenir un secret.

---

# 30. SSE

Utiliser **Server-Sent Events** pour :

- progression des jobs ;
- logs d’installation ;
- notifications temps réel ;
- changements d’état importants.

Exemple :

```text
GET /api/v1/jobs/{job_id}/events
```

React s’abonne au flux pendant l’opération.

Pas besoin de WebSocket dans le MVP.

---

# 31. Centre de notifications

Différencier :

## Toast

Temporaire :

```text
Sonarr redémarré
```

## Notification persistante

Exemples :

```text
Échec installation StreamFusion
Mise à jour SSDV2 disponible
Backup terminé
3 conteneurs SSDV2 sont arrêtés
5 volumes orphelins détectés
```

Champs :

```text
id
severity
title
message
created_at
read_at
link
source
```

Niveaux :

```text
info
success
warning
error
```

Prévoir :

- badge non-lu ;
- marquer comme lu ;
- tout marquer comme lu ;
- lien vers ressource concernée.

---

# 32. Diagnostics

Les fonctions déjà présentes dans SSDV2 comprennent notamment des contrôles sur :

- registres conteneurs manquants ;
- conteneurs orphelins ;
- volumes Docker orphelins.

La WebUI doit proposer une page dédiée.

Exemple :

```text
Diagnostic SSDV2

✓ Docker accessible
✓ Traefik actif
✓ Base SSDV2 accessible

⚠ 2 registres manquants
⚠ 3 volumes anonymes orphelins
✗ 1 conteneur SSDV2 orphelin
```

Actions :

```text
Régénérer registres
Supprimer conteneurs orphelins
Supprimer volumes orphelins
```

Toutes les réparations doivent demander confirmation.

---

# 33. Sauvegardes

Fonctions souhaitées :

- voir configuration backup ;
- voir dernier backup ;
- lancer backup ;
- historique ;
- taille ;
- statut ;
- restauration ;
- suppression d’une archive éventuellement.

La restauration est une opération critique.

Elle nécessite :

- confirmation forte ;
- résumé ;
- éventuelle saisie du nom de l’application ou mot `RESTAURER`.

---

# 34. Docker

Une page Docker avancée peut être prévue, mais la priorité reste SSDV2.

Fonctions utiles :

- conteneurs SSDV2 ;
- images ;
- volumes ;
- réseaux ;
- utilisation ressources.

Par défaut, privilégier les ressources SSDV2 plutôt que tout le Docker de l’hôte.

Un mode avancé pourrait afficher toutes les ressources.

---

# 35. Traefik / DNS

Afficher lorsque disponible :

- domaine principal ;
- sous-domaine ;
- URL calculée ;
- statut DNS ;
- labels Traefik principaux ;
- middleware auth ;
- resolver TLS ;
- IP résolue.

Cloudflare :

- état activé/désactivé ;
- zone ;
- opérations DNS ;
- jamais afficher le token complet.

---

# 36. Mise à jour SSDV2

Afficher :

```text
branche
commit local
commit distant
mise à jour disponible
```

Éventuellement :

```text
git pull
```

mais cette fonction doit arriver après le MVP car elle modifie le moteur que la WebUI utilise elle-même.

Afficher d’abord l’information en lecture seule.

---

# 37. Patches SSDV2

SSDV2 possède un mécanisme de patches.

La WebUI pourra afficher :

- patches disponibles ;
- patches appliqués ;
- éventuels patches en erreur.

Éviter d’introduire une seconde logique de migration.

---

# 38. Paramètres

Sections possibles :

```text
Général
Domaine
Cloudflare
Authentification
Chemins
Docker
Interface
Notifications
Sécurité
```

Les champs secrets doivent apparaître comme :

```text
••••••••••••
```

avec action explicite pour remplacer le secret.

Ne jamais retourner les secrets au frontend simplement pour afficher un formulaire.

---

# 39. Recherche globale / Command Palette

Ajouter une Command Palette accessible avec :

```text
Ctrl+K
Cmd+K
```

Exemple :

```text
> sonarr

Sonarr — Ouvrir
Sonarr — Logs
Sonarr — Redémarrer
Sonarr — Configuration
```

Autres commandes :

```text
Dashboard
Jobs
Diagnostics
Backup
Paramètres Cloudflare
```

Très utile avec ~190 applications.

---

# 40. Favoris / applications épinglées

Fonction secondaire mais simple :

- épingler une application ;
- afficher les favoris en haut ;
- accès rapide dashboard.

Les favoris sont une donnée WebUI et peuvent être stockés dans sa SQLite.

---

# 41. Thème

Prévoir :

```text
light
dark
system
```

Le dark mode est particulièrement adapté à ce type d’outil admin.

---

# 42. Backend FastAPI

Structure recommandée :

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── apps.py
│   │   ├── jobs.py
│   │   ├── system.py
│   │   ├── docker.py
│   │   ├── auth.py
│   │   ├── backups.py
│   │   ├── diagnostics.py
│   │   ├── notifications.py
│   │   └── settings.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── logging.py
│   │
│   ├── services/
│   │   ├── ssdv2.py
│   │   ├── docker.py
│   │   ├── jobs.py
│   │   ├── notifications.py
│   │   ├── catalogue.py
│   │   └── diagnostics.py
│   │
│   ├── adapters/
│   │   ├── ssdv2_cli.py
│   │   ├── docker.py
│   │   ├── filesystem.py
│   │   └── git.py
│   │
│   ├── models/
│   ├── schemas/
│   └── db/
│
└── tests/
```

Règle :

> Les routes HTTP ne doivent pas contenir la logique SSDV2.

---

# 43. Frontend React

Structure possible :

```text
frontend/
├── src/
│   ├── app/
│   ├── routes/
│   ├── components/
│   ├── features/
│   │   ├── apps/
│   │   ├── jobs/
│   │   ├── dashboard/
│   │   ├── notifications/
│   │   ├── backups/
│   │   ├── diagnostics/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   ├── api/
│   └── types/
```

Organisation par fonctionnalité plutôt qu’un énorme dossier de composants génériques.

---

# 44. API proposée

Préfixe :

```text
/api/v1
```

## Applications

```text
GET    /api/v1/apps
GET    /api/v1/apps/{app}

POST   /api/v1/apps/{app}/install
POST   /api/v1/apps/{app}/start
POST   /api/v1/apps/{app}/stop
POST   /api/v1/apps/{app}/restart
POST   /api/v1/apps/{app}/reinstall

DELETE /api/v1/apps/{app}
```

Suppression :

```json
{
  "keep_data": true
}
```

---

## Bulk

```text
POST /api/v1/apps/bulk/restart
POST /api/v1/apps/bulk/start
POST /api/v1/apps/bulk/stop
POST /api/v1/apps/bulk/auth
```

Payload :

```json
{
  "apps": ["sonarr", "radarr", "prowlarr"]
}
```

---

## Logs

```text
GET /api/v1/apps/{app}/logs
GET /api/v1/containers/{container}/logs
```

---

## Jobs

```text
GET /api/v1/jobs
GET /api/v1/jobs/{id}
GET /api/v1/jobs/{id}/events
```

---

## Notifications

```text
GET   /api/v1/notifications
PATCH /api/v1/notifications/{id}/read
POST  /api/v1/notifications/read-all
```

---

## Dashboard

```text
GET /api/v1/system/summary
```

---

## Diagnostics

```text
GET  /api/v1/diagnostics
POST /api/v1/diagnostics/registries/rebuild
POST /api/v1/diagnostics/orphans/containers/cleanup
POST /api/v1/diagnostics/orphans/volumes/cleanup
```

---

## Backups

```text
GET  /api/v1/backups
POST /api/v1/backups
POST /api/v1/backups/{id}/restore
```

---

## Settings

```text
GET   /api/v1/settings
PATCH /api/v1/settings
```

Ne jamais renvoyer un secret brut via `GET`.

---

# 45. Modèle SQLite de la WebUI

La SQLite WebUI ne doit pas recopier tout SSDV2.

Tables proposées :

```text
users
sessions

jobs
job_events

notifications

audit_events

webui_settings
favorites
```

Éventuellement :

```text
catalogue_metadata_cache
```

mais uniquement comme cache.

---

# 46. Table Jobs

Exemple :

```text
jobs
----
id
type
target_type
target_id
status
progress
created_at
started_at
finished_at
error_code
error_message
created_by
```

---

# 47. Audit

Toutes les actions importantes doivent être auditées.

Exemple :

```text
17/09/2026 09:45
admin
restart
sonarr
success
```

Actions à auditer :

- login ;
- installation ;
- suppression ;
- restart ;
- changement d’auth ;
- modification paramètres ;
- backup ;
- restore ;
- cleanup ;
- mise à jour.

Ne pas enregistrer de secrets.

---

# 48. Calcul de l’état d’une application

Ne pas utiliser une seule source.

Construire un `AppState` à partir de :

1. catalogue `services-available` ;
2. `ssddb` ;
3. labels Docker `ssdv2.app` ;
4. registres `.containers`, `.volumes`, `.dns` ;
5. état réel Docker ;
6. configuration `account.yml` ;
7. labels Traefik.

Exemple :

```json
{
  "name": "sonarr",
  "available": true,
  "installed": true,
  "runtime_status": "running",
  "healthy": true,
  "auth": "authelia",
  "url": "https://sonarr.example.com",
  "containers": 1,
  "volumes": 0,
  "warnings": []
}
```

La WebUI ne doit pas décider qu’une application est installée uniquement parce qu’un conteneur portant son nom existe.

---

# 49. Gestion des incohérences

Exemples :

```text
ssddb dit installée mais aucun conteneur
conteneur labelisé mais app absente de ssddb
registre containers absent
DNS absent
conteneur unhealthy
```

Ces situations doivent être affichées comme :

```text
warning
degraded
inconsistent
```

et non masquées.

---

# 50. Performances

Avec ~190 applications :

- charger le catalogue complet côté client est acceptable ;
- filtrage/tri peuvent être côté client ;
- les informations Docker doivent être récupérées de façon groupée ;
- éviter un appel Docker/API par ligne ;
- construire une seule vue agrégée backend.

Exemple :

```text
GET /api/v1/apps
```

doit retourner tous les états nécessaires à la table principale.

Éviter :

```text
190 x GET /api/v1/apps/{app}
```

---

# 51. Rafraîchissement

Ne pas faire du polling agressif.

Proposition :

- dashboard : toutes les 10–30 secondes ;
- apps : toutes les 15–30 secondes ou invalidation après action ;
- jobs : SSE ;
- notifications : SSE ;
- logs : stream dédié.

---

# 52. Gestion des erreurs

Le backend doit renvoyer des erreurs structurées.

Exemple :

```json
{
  "error": {
    "code": "APP_INSTALL_FAILED",
    "message": "L'installation de Sonarr a échoué",
    "details": {
      "job_id": "..."
    }
  }
}
```

Ne jamais envoyer au frontend une stack trace Python brute en production.

---

# 53. Confirmation des actions destructrices

Niveau 1 :

```text
Redémarrer
```

simple confirmation éventuelle.

Niveau 2 :

```text
Supprimer application en conservant les données
```

confirmation claire.

Niveau 3 :

```text
Supprimer application + données
Restaurer backup
Supprimer volumes orphelins
```

confirmation forte.

Exemple :

```text
Tapez "sonarr" pour confirmer.
```

---

# 54. Image Docker

Utiliser un build multi-stage.

Concept :

```text
Stage frontend
--------------
node
npm/pnpm
vite build

Stage runtime
-------------
python:3.13-slim
FastAPI
Docker SDK
runtime SSDV2 nécessaire
frontend dist
```

Le runtime final ne doit pas contenir Node sauf nécessité démontrée.

---

# 55. Multi-architecture

Publier :

```text
linux/amd64
linux/arm64
```

via GitHub Actions + buildx.

Image :

```text
ghcr.io/projetssd/ssdv2-webui
```

Tags possibles :

```text
latest
main
1.0.0
1.0
sha-xxxxxxx
```

---

# 56. Healthcheck

Prévoir :

```text
GET /health
```

et idéalement :

```text
GET /api/v1/health
```

Réponse :

```json
{
  "status": "ok",
  "docker": true,
  "ssdv2": true,
  "database": true
}
```

Docker healthcheck doit utiliser cet endpoint.

---

# 57. Mode dégradé

Si Docker socket est inaccessible :

la WebUI doit démarrer et afficher :

```text
Docker indisponible
```

plutôt que crash-loop.

Même logique si :

- SSDV2_SOURCE absent ;
- SSDV2_STORAGE absent ;
- ssddb absent ;
- account.yml inaccessible.

---

# 58. Tests backend

Utiliser `pytest`.

Tester :

- parser catalogue ;
- détection installed/running ;
- agrégation AppState ;
- validation nom application ;
- adapter `ssdv2ctl` ;
- Docker adapter mocké ;
- jobs ;
- transitions de statuts ;
- secret redaction ;
- endpoints ;
- permissions.

---

# 59. Tests frontend

Utiliser :

- Vitest ;
- React Testing Library.

Tester au minimum :

- table applications ;
- filtres ;
- sélection multiple ;
- menu actions ;
- confirmations ;
- états loading/error ;
- notifications.

Ajouter Playwright plus tard pour les flux critiques.

---

# 60. CI

Pipeline GitHub Actions recommandé :

```text
lint frontend
typecheck frontend
tests frontend

ruff backend
mypy/pyright éventuellement
pytest backend

build frontend
build backend
build Docker

multiarch release
```

Pas de publication d’image sur chaque PR si cela coûte inutilement des minutes.

La publication peut être :

- manuelle ;
- sur tag ;
- éventuellement sur master selon politique projet.

---

# 61. Logging

Backend :

- logs structurés ;
- niveau INFO par défaut ;
- correlation ID / request ID ;
- job ID dans les événements concernés.

Ne jamais logger :

```text
Cloudflare token
API keys
password
JWT secret
Ansible Vault password
cookies
Authorization header
```

Créer une fonction centrale de redaction.

---

# 62. Ce qu’il ne faut PAS faire

## Ne pas réutiliser l’ancienne WebUI

Interdit par le cahier des charges.

## Ne pas faire de frontend en Jinja/HTMX comme architecture principale

L’interface prévue est trop riche :

- beaucoup de tableaux ;
- actions groupées ;
- formulaires complexes ;
- temps réel ;
- état local ;
- menus ;
- notifications.

React est mieux adapté.

## Ne pas créer microservices

Pas de :

```text
frontend container
backend container
worker container
redis container
postgres container
```

Le besoin peut être couvert par **une image / un conteneur**.

## Ne pas mettre Redis/Celery au MVP

Inutile pour le volume attendu.

## Ne pas exposer un terminal root

Pas de :

```text
POST /shell
```

## Ne pas accepter directement une commande utilisateur

Interdit :

```python
subprocess.run(user_input, shell=True)
```

## Ne pas dupliquer SSDV2 dans SQLite

Le catalogue et les états doivent rester issus des sources SSDV2/Docker.

---

# 63. Ordre de développement recommandé

## Phase 0 — contrat SSDV2

Créer/normaliser :

```text
ssdv2ctl
```

Fonctions prioritaires :

```text
apps list
app status
app install
app remove
app reinstall
app start
app stop
app restart
auth get/set
diagnostics
```

Sorties JSON et non-interactives.

---

## Phase 1 — socle WebUI

Créer :

- FastAPI ;
- React/Vite ;
- shadcn ;
- SQLite ;
- auth admin ;
- Docker build ;
- Traefik ;
- healthcheck.

---

## Phase 2 — lecture seule

Créer :

- dashboard ;
- liste ~190 apps ;
- filtres ;
- page app ;
- conteneurs ;
- état Docker ;
- URL ;
- auth ;
- logs.

Cette phase valide l’architecture sans risque destructif.

---

## Phase 3 — lifecycle

Ajouter :

- jobs ;
- SSE ;
- install ;
- start ;
- stop ;
- restart ;
- reinstall ;
- remove ;
- confirmations.

---

## Phase 4 — administration

Ajouter :

- auth bulk ;
- configuration ;
- notifications persistantes ;
- audit ;
- backups ;
- diagnostics.

---

## Phase 5 — avancé

Ajouter éventuellement :

- gestion mise à jour SSDV2 ;
- Git ;
- patches ;
- Docker avancé ;
- fonctions host spécifiques via mécanisme sécurisé.

---

# 64. MVP réellement utile

Pour considérer la WebUI comme déjà utile :

1. connexion admin ;
2. dashboard ;
3. table des ~190 apps ;
4. recherche/filtres ;
5. détail d’une app ;
6. état Docker réel ;
7. logs ;
8. install ;
9. start/stop/restart ;
10. suppression ;
11. job + progression ;
12. notifications ;
13. changement auth ;
14. diagnostic basique.

Tout le reste peut venir ensuite.

---

# 65. Design de l’écran principal

Exemple :

```text
┌────────────────────────────────────────────────────────────────────┐
│ SSDV2            🔎 Rechercher / ⌘K            🔔 3       Admin   │
├──────────────────┬─────────────────────────────────────────────────┤
│ Dashboard        │ Applications                         37 / 190   │
│ Applications     │                                                 │
│ Jobs             │ [Recherche........] [État] [Auth] [Catégorie] │
│ Notifications    │                                                 │
│                  │ ☑  Nom      État   Auth      Domaine      •••  │
│ Backups          │ □  Sonarr   ● OK   Authelia  sonarr...    •••  │
│ Diagnostics      │ □  Radarr   ● OK   OAuth     radarr...    •••  │
│                  │ □  Prowlarr ○ OFF  Authelia  prowlarr...  •••  │
│ Settings         │ □  Wallos   --     --        --          Install│
└──────────────────┴─────────────────────────────────────────────────┘
```

---

# 66. Ergonomie souhaitée

Le produit doit être :

- rapide ;
- dense ;
- cohérent ;
- prévisible ;
- clavier-friendly ;
- sans animations inutiles ;
- avec états de chargement clairs ;
- avec actions destructrices très identifiables ;
- avec dark mode de qualité.

Éviter :

- énormes cartes ;
- grands espaces inutiles ;
- interfaces « marketing » ;
- modales imbriquées ;
- refresh page complet après chaque action.

---

# 67. Internationalisation

SSDV2 possède déjà des mécanismes i18n côté CLI.

La nouvelle WebUI peut démarrer en français mais son architecture frontend doit permettre une traduction ultérieure.

Éviter les textes dispersés dans les composants.

Prévoir éventuellement :

```text
src/i18n/fr.json
src/i18n/en.json
```

mais cela peut attendre après le MVP.

---

# 68. API OpenAPI

FastAPI génère OpenAPI.

Profiter de cela pour :

- documentation ;
- client TypeScript ;
- contrats ;
- tests.

Idéalement générer les types frontend depuis l’OpenAPI plutôt que recopier manuellement les DTO.

---

# 69. Versioning API

Utiliser dès le départ :

```text
/api/v1
```

même si seule une version existe.

---

# 70. Compatibilité

La WebUI doit viser :

- Chrome/Chromium récents ;
- Firefox récent ;
- Safari récent.

Serveur :

- Debian/Ubuntu supportés par SSDV2 ;
- AMD64 ;
- ARM64.

---

# 71. Principes pour le coding agent

Toute IA travaillant sur ce projet doit respecter les règles suivantes.

## Règle 1

Avant de modifier une fonctionnalité SSDV2 :

> inspecter le mécanisme existant dans le dépôt.

Ne pas réinventer à partir du nom d’une fonction.

## Règle 2

Ne jamais utiliser l’ancienne WebUI comme base technique.

## Règle 3

Préférer un **vertical slice fonctionnel**.

Exemple :

```text
Lister les apps
→ backend
→ API
→ frontend
→ tests
```

plutôt que créer 50 abstractions avant d’avoir un écran fonctionnel.

## Règle 4

Toute action mutante doit passer par un service métier/backend.

React ne doit jamais connaître :

```text
bash
ansible-playbook
docker CLI
chemins internes
vault
```

## Règle 5

Toute entrée utilisateur envoyée à un subprocess doit être :

- validée ;
- typée ;
- issue d’une allowlist lorsque possible.

## Règle 6

Ne jamais utiliser `shell=True` avec une chaîne construite depuis les paramètres HTTP.

## Règle 7

Ne jamais afficher/logguer un secret.

## Règle 8

Utiliser les labels :

```text
ssdv2.app
```

et les registres SSDV2 existants avant d’inventer un nouveau mapping.

## Règle 9

La SQLite WebUI n’est pas la source de vérité sur les applications.

## Règle 10

Maintenir une seule image Docker tant qu’une contrainte technique réelle n’impose pas autre chose.

---

# 72. Questions architecturales à résoudre pendant l’implémentation

Ces sujets doivent être décidés explicitement et non par accident.

## Exécution des commandes SSDV2 depuis le conteneur

Déterminer quelles commandes sont :

- container-compatible ;
- host-only.

Ne pas supposer que `localhost` Ansible = hôte physique.

## Évolution `ssdv2ctl`

Déterminer le meilleur format :

- Python ;
- Bash robuste ;
- hybride.

Préférence : interface non interactive avec JSON.

## Catalogue enrichi

Décider si les catégories/icônes/tags sont :

- maintenus dans SSDV2 ;
- maintenus dans le dépôt WebUI ;
- récupérés dynamiquement.

Recommandation : métadonnées de présentation dans SSDV2 ou dans un fichier dédié, sans dupliquer la logique de déploiement.

---

# 73. Critères de réussite

Le projet peut être considéré réussi lorsque :

- la WebUI se déploie avec une seule image ;
- SSDV2 continue de fonctionner sans elle ;
- AMD64 et ARM64 fonctionnent ;
- les ~190 applications sont visibles ;
- la table reste fluide ;
- les états reflètent Docker/SSDV2 réellement ;
- install/remove/restart fonctionnent ;
- les jobs longs ne bloquent pas HTTP ;
- les logs arrivent en temps réel ;
- les notifications fonctionnent ;
- les actions groupées fonctionnent ;
- les secrets restent protégés ;
- aucune commande shell arbitraire n’est exposée ;
- l’ancienne WebUI n’est pas nécessaire.

---

# 74. Vision finale

La nouvelle WebUI ne doit pas devenir « un deuxième SSDV2 ».

Elle doit être :

> **une interface moderne au-dessus du moteur SSDV2.**

Architecture cible :

```text
                     SSDV2
                       │
      ┌────────────────┴────────────────┐
      │                                 │
  Moteur existant                   ssdv2ctl
 Bash / Ansible / Docker                │
                                        │
                              API FastAPI
                                        │
                              React / shadcn
                                        │
                                   Navigateur
```

Le moteur SSDV2 conserve :

- le déploiement ;
- les règles métier ;
- les configurations ;
- les registres ;
- les scripts ;
- la compatibilité CLI.

La WebUI apporte :

- visibilité ;
- ergonomie ;
- recherche ;
- tableaux ;
- actions groupées ;
- jobs ;
- logs ;
- notifications ;
- diagnostics ;
- historique ;
- administration graphique.

---

# 75. Décision technique synthétique

Si une IA doit démarrer le projet sans autre contexte, partir sur :

```text
Frontend
--------
React
TypeScript
Vite
shadcn/ui
Tailwind
TanStack Table
TanStack Query
React Router
React Hook Form
Zod
Sonner
Lucide

Backend
-------
Python 3.13
FastAPI
Pydantic
Docker SDK
SQLite
SQLAlchemy 2
SSE
pytest

Packaging
---------
Docker multi-stage
1 image finale
GHCR
linux/amd64
linux/arm64

Architecture SSDV2
------------------
SSDV2 reste source de vérité
ssdv2ctl = couche de contrôle non interactive
Docker label ssdv2.app
registres .containers/.volumes/.dns
ssddb
account.yml / Ansible Vault
```

Priorité absolue :

> **Faire simple, fortement typé, observable, sécurisé, sans réécrire le moteur SSDV2 et sans reconstruire l’ancienne WebUI.**
