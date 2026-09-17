from datetime import UTC, datetime, timedelta

import docker

from app.schemas.app import AppStateOut
from app.schemas.updates import UpdateEntry, UpdatesOut

CACHE_TTL = timedelta(minutes=30)
MIN_REFRESH_INTERVAL = timedelta(seconds=60)

_cache: tuple[datetime, list[UpdateEntry]] | None = None


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
            current = None
            try:
                current = local_digest(client.images.get(state.image))
            except docker.errors.DockerException:
                current = None
            available = registry_digest(client, state.image)
            entry.current_digest = short_digest(current)
            entry.available_digest = short_digest(available)
            if current and available:
                entry.status = "up_to_date" if current == available else "available"
        entries.append(entry)

    entries.sort(key=lambda item: (item.status != "available", item.app))
    _cache = (reference, entries)
    return UpdatesOut(
        checked_at=reference,
        entries=entries,
        available=sum(1 for entry in entries if entry.status == "available"),
    )
