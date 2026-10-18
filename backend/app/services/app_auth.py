"""Application d'un changement d'authentification SSDV2 sans playbook.

Le type d'authentification d'une application se traduit par la chaîne de
middlewares Traefik du *router principal* : ``traefik.http.routers.<app>-rtr.middlewares``
(voir ``templates/generique/traefik_labels.yml.j2``). Modifier ce label impose de
recréer le conteneur (labels Docker immuables), mais **sans** rejouer le playbook
SSDV2 : on clone le conteneur à l'identique et on ne change que ce label.
"""

from __future__ import annotations

from collections.abc import Callable

import docker

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.core.config import Settings
from app.services.app_update import app_container_names, recreate_container

EventSink = Callable[[str], None]

AUTH_CHAINS = {
    "aucune": "chain-no-auth@file",
    "basique": "chain-basic-auth@file",
    "oauth": "chain-oauth@file",
    "authelia": "chain-authelia@file",
    "oauth2-proxy": "chain-oauth2-proxy@file",
}

DEFAULT_CHAIN = "chain-no-auth@file"


def auth_chain(auth: str) -> str:
    """Chaîne de middlewares Traefik associée au type d'authentification."""
    return AUTH_CHAINS.get(auth, DEFAULT_CHAIN)


def middlewares_label(app: str) -> str:
    """Label du router principal de l'application (convention SSDV2 générique)."""
    return f"traefik.http.routers.{app}-rtr.middlewares"


def apply_app_auth(
    client: docker.DockerClient,
    settings: Settings,
    app: str,
    auth: str,
    on_event: EventSink,
) -> tuple[int, str | None]:
    """Applique le type d'auth aux conteneurs de l'app (label Traefik seul).

    Ne touche que le router principal ``<app>-rtr`` : les routers secondaires
    (public/bypass/torznab/relay…) sont laissés intacts. Les conteneurs sans ce
    label (sidecars, apps internes) sont ignorés.
    """
    names = app_container_names(settings, client, app)
    if not names:
        return 1, f"aucun conteneur pour {app}"

    chain = auth_chain(auth)
    label = middlewares_label(app)
    changed = 0
    for name in names:
        try:
            container = client.containers.get(name)
        except docker.errors.NotFound:
            on_event(f"conteneur introuvable : {name}")
            return 1, f"conteneur introuvable : {name}"
        labels = (container.attrs.get("Config") or {}).get("Labels") or {}
        if label not in labels:
            on_event(f"{name} : pas de router « {app}-rtr », ignoré (label inchangé)")
            continue
        current = labels.get(label)
        if current == chain:
            on_event(f"{name} : déjà « {chain} », rien à faire")
            continue
        on_event(f"{name} : « {current} » → « {chain} »")
        try:
            recreate_container(client, container, label_overrides={label: chain})
        except (docker.errors.DockerException, Ssdv2CtlError) as exc:
            return 1, f"échec de la recréation de {name}: {exc}"
        on_event(f"{name} recréé (authentification appliquée)")
        changed += 1

    if changed == 0:
        on_event(f"{app} : aucun changement d'authentification à appliquer")
    return 0, None
