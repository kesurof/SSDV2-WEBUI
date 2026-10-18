# Héberger la WebUI derrière un reverse proxy

La WebUI SSDV2 fonctionne sur un domaine dédié, avec une **connexion interne conservée par
défaut** (ADR-0018). Traefik, Nginx, Caddy, Authelia, oauth2-proxy ou Cloudflare Access
peuvent ajouter leur authentification. Le conteneur n'est **jamais** exposé directement.

## Règles communes

- Le reverse proxy protège le domaine en HTTPS ; `COOKIE_SECURE=true`.
- Protéger avec le **même** périmètre d'authentification externe : le HTML, `/api/v1/`,
  les assets et **les flux SSE**.
- Transmettre les flux SSE sans mise en tampon (`X-Accel-Buffering: no` déjà émis par
  l'application) avec un **timeout de lecture supérieur à 25 s** (le serveur envoie un
  heartbeat toutes les 25 s) ; 120 s ou davantage conseillés.
- Ne pas mettre en cache les flux `.../events` et `.../logs/stream`.

Flux temps réel exposés :

| Flux | Chemin |
|---|---|
| Notifications | `GET /api/v1/notifications/events` |
| Jobs | `GET /api/v1/jobs/{id}/events` |
| Logs d'application | `GET /api/v1/apps/{app}/logs/stream` |

## oauth2-proxy / Authelia / Cloudflare Access

Ces fournisseurs protègent les requêtes en amont ; le formulaire interne de la WebUI reste
utilisable. Les cookies des deux systèmes sont indépendants.

Le mode d'authentification est `internal` (identifiant/mot de passe) ou `proxy` (identité
fournie par le proxy). Il se choisit à l'assistant `/setup` ou dans Réglages → Sécurité, et
peut être imposé par `WEBUI_AUTH_MODE`. En mode `proxy`, l'identité est lue dans **un seul**
en-tête (`WEBUI_PROXY_IDENTITY_HEADER`, défaut `X-Auth-Request-User`) et uniquement depuis
une source listée dans `WEBUI_TRUSTED_PROXIES` (IP/CIDR) — ou, en opt-in moins strict,
`WEBUI_TRUST_PROXY=true`. Sans proxy de confiance configuré, les accès protégés sont
refusés (fail-closed).

| Fournisseur | En-tête courant |
|---|---|
| oauth2-proxy | `X-Auth-Request-User` |
| Authelia | `Remote-User` |
| Proxy OAuth générique | `X-Forwarded-User` |
| Cloudflare Access | `Cf-Access-Authenticated-User-Email` |

L'en-tête doit être **écrasé** par le proxy (`authResponseHeaders` côté Traefik) et ne
jamais pouvoir être injecté par le client. `WEBUI_EXTERNAL_LOGOUT_URL` permet de proposer la
déconnexion du fournisseur depuis le menu utilisateur.

Quand un flux SSE perd l'authentification, le serveur renvoie **HTTP 200** avec la trame
`data: {"auth":"required"}` (et non un 401, invisible pour `EventSource`). Le front arrête
alors ses reconnexions et redirige vers la connexion. Une page HTML de connexion renvoyée
par le proxy (parfois en HTTP 200) est traitée comme une **erreur explicite**, sans boucle
de rechargement.

## Nginx

```nginx
location / {
    proxy_pass http://ssdv2-webui:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
```

## Caddy

```caddyfile
ssdv2.example.tld {
    reverse_proxy ssdv2-webui:8000 {
        flush_interval -1
    }
}
```

## Traefik

Router standard, sans middleware SSE spécifique (les flux passent par les routes normales,
exclues du gzip par chemin). En déploiement SSDV2, le router `ssdv2webui-rtr` peut être
placé derrière `chain-oauth2-proxy@file`.

## Vérification

Tester dans le navigateur : connexion, **notifications**, un **job** et le **suivi de logs
en direct**. Une coupure doit se rétablir automatiquement (reprise `?after=`), sans
duplication. En cas de page de connexion HTML reçue par l'API, corriger la configuration du
fournisseur externe, sans ajouter de boucle de rechargement.
