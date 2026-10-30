from datetime import UTC, datetime, timedelta

import docker

from app.schemas.app import AppStateOut
from app.schemas.updates import UpdateEntry, UpdatesOut

CACHE_TTL = timedelta(minutes=30)
MIN_REFRESH_INTERVAL = timedelta(seconds=60)

_cache: tuple[datetime, list[UpdateEntry]] | None = None


def clear_cache() -> None:
    global _cache
    _cache = None


def short_digest(digest: str | None) -> str | None:
    if not digest:
        return None
    value = digest.split(":", 1)[-1]
    return value[:12]


def local_digest(image: docker.models.images.Image) -> str | None:
    for reference in image.attrs.get("RepoDigests") or []:
        _, separator, digest = reference.partition("@")
        if separator and digest:
            return digest
    return None


def image_digest(client: docker.DockerClient, image_id: str) -> str | None:
    """Digest d'une image désignée par son ID (image réellement exécutée)."""
    try:
        return local_digest(client.images.get(image_id))
    except docker.errors.DockerException:
        return None


def registry_digest(client: docker.DockerClient, image_ref: str) -> str | None:
    try:
        data = client.images.get_registry_data(image_ref)
    except docker.errors.DockerException:
        return None
    return getattr(data, "id", None)


def build_updates(
    states: list[AppStateOut],
    client: docker.DockerClient | None,
    *,
    now: datetime | None = None,
    force: bool = False,
) -> UpdatesOut:
    reference = now or datetime.now(UTC).replace(tzinfo=None)
    global _cache
    if _cache is not None:
        age = reference - _cache[0]
        too_soon = age < MIN_REFRESH_INTERVAL
        if (not force and age < CACHE_TTL) or (force and too_soon):
            entries = _cache[1]
            return UpdatesOut(
                checked_at=_cache[0],
                entries=entries,
                available=sum(1 for entry in entries if entry.status == "available"),
            )

    entries: list[UpdateEntry] = []
    for state in states:
        if not state.installed or not state.image:
            continue
        entry = UpdateEntry(app=state.name, image=state.image)
        if client is not None:
            tag_image = None
            tag_digest = None
            current = None
            try:
                tag_image = client.images.get(state.image)
                tag_digest = local_digest(tag_image)
                current = tag_digest
            except docker.errors.DockerException:
                current = None
            available = registry_digest(client, state.image)

            running_ids = state.running_image_ids.get(state.image) or []
            if tag_image is None:
                # Tag local absent : comparer l'image du conteneur au registre pour ne
                # pas conclure « inconnu » alors qu'un conteneur est obsolète.
                if running_ids:
                    running = image_digest(client, running_ids[0])
                    if running:
                        current = running
                        if available is not None:
                            entry.status = "up_to_date" if running == available else "available"
            else:
                stale_ids = [image_id for image_id in running_ids if image_id != tag_image.id]
                if stale_ids:
                    # Le tag local est à jour mais le conteneur tourne encore une
                    # ancienne image : proposer la recréation (ADR-0033).
                    entry.status = "available"
                    entry.needs_recreate = tag_digest is not None and (
                        available is None or available == tag_digest
                    )
                    current = image_digest(client, stale_ids[0])
                    if available is None:
                        available = tag_digest

            entry.current_digest = short_digest(current)
            entry.available_digest = short_digest(available)
            if tag_image is not None and not entry.needs_recreate and current and available:
                entry.status = "up_to_date" if current == available else "available"
        entries.append(entry)

    entries.sort(key=lambda item: (item.status != "available", item.app))
    _cache = (reference, entries)
    return UpdatesOut(
        checked_at=reference,
        entries=entries,
        available=sum(1 for entry in entries if entry.status == "available"),
    )
