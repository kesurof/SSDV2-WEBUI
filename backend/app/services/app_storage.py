from datetime import UTC, datetime, timedelta

import docker

from app.schemas.app import AppStorageOut, VolumeUsageOut

STORAGE_CACHE_TTL = timedelta(seconds=60)

_cache: tuple[datetime, dict[str, tuple[int | None, int | None]]] | None = None


def read_volume_usage(
    client: docker.DockerClient | None,
    *,
    now: datetime | None = None,
    force: bool = False,
) -> dict[str, tuple[int | None, int | None]]:
    """Tailles des volumes Docker via `docker system df` (cache 60 s)."""
    global _cache
    reference = now or datetime.now(UTC).replace(tzinfo=None)
    if _cache is not None and not force and reference - _cache[0] < STORAGE_CACHE_TTL:
        return _cache[1]

    usage: dict[str, tuple[int | None, int | None]] = {}
    if client is not None:
        try:
            report = client.df()
        except docker.errors.DockerException:
            report = {}
        for volume in report.get("Volumes") or []:
            name = volume.get("Name")
            if not name:
                continue
            data = volume.get("UsageData") or {}
            usage[name] = (data.get("Size"), data.get("RefCount"))

    _cache = (reference, usage)
    return usage


def build_app_storage(
    app: str,
    volume_names: list[str],
    usage: dict[str, tuple[int | None, int | None]],
) -> AppStorageOut:
    volumes: list[VolumeUsageOut] = []
    total: int | None = 0
    for name in volume_names:
        size, ref_count = usage.get(name, (None, None))
        volumes.append(VolumeUsageOut(name=name, size_bytes=size, ref_count=ref_count))
        if size is None:
            total = None
        elif total is not None:
            total += size
    return AppStorageOut(
        app=app,
        volumes=volumes,
        total_size_bytes=total if volumes else None,
        warnings=[] if usage else ["docker_df_unavailable"],
    )
