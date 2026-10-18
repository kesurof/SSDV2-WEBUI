"""Identité fournie par un proxy d'authentification externe (forwardAuth SSDV2).

La WebUI ne fait confiance qu'à **un seul en-tête** explicitement configuré
(`WEBUI_PROXY_IDENTITY_HEADER`, par défaut `X-Auth-Request-User` pour oauth2-proxy)
et uniquement quand la requête provient d'une source listée dans
`WEBUI_TRUSTED_PROXIES` (IP/CIDR explicites). Aucune détection automatique : si aucun
proxy n'est configuré, l'accès est refusé (fail-closed).

Correspondance en-tête / fournisseur (le header doit figurer dans les
`authResponseHeaders` de la chaîne Traefik pour être écrasé et donc infalsifiable) :
- oauth2-proxy : `X-Auth-Request-User`
- oauth         : `X-Forwarded-User`
- Authelia      : `Remote-User`
"""

from __future__ import annotations

import ipaddress

from fastapi import Request

from app.core.config import Settings

IpNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


def trusted_proxy_networks(settings: Settings) -> tuple[IpNetwork, ...]:
    networks = []
    for entry in settings.trusted_proxies.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            return ()  # Entrée invalide : ne faire confiance à aucune source.
    return tuple(networks)


def trusted_proxies_configured(settings: Settings) -> bool:
    return settings.trust_proxy or bool(trusted_proxy_networks(settings))


def _is_trusted_source(host: str | None, networks: tuple) -> bool:
    if not host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(address in network for network in networks)


def proxy_identity(request: Request, settings: Settings) -> str | None:
    """Renvoie l'identité validée par le proxy autorisé, ou None (fail-closed)."""
    networks = trusted_proxy_networks(settings)
    client = request.client
    if not settings.trust_proxy and (
        client is None or not _is_trusted_source(client.host, networks)
    ):
        return None
    values = request.headers.getlist(settings.proxy_identity_header)
    if len(values) != 1:
        return None
    identity = values[0].strip()
    if (
        not identity
        or len(identity) > 64
        or "," in identity
        or any(ord(char) < 32 or ord(char) == 127 for char in identity)
    ):
        return None
    return identity
