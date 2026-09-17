from datetime import UTC, datetime, timedelta

import docker

from app.schemas.app import AppEnvVarOut, ContainerStatsOut

STATS_CACHE_TTL = timedelta(seconds=15)

ENV_ALLOWLIST = frozenset({"TZ", "PUID", "PGID", "UMASK", "LANG", "LC_ALL"})
ENV_ALLOWLIST_PREFIXES = ("DOZZLE_",)
SENSITIVE_MARKERS = (
    "PASSWORD",
    "PASSWD",
    "TOKEN",
    "SECRET",
    "API_KEY",
    "APIKEY",
    "CREDENTIAL",
    "VAULT",
    "PRIVATE",
)

_stats_cache: dict[str, tuple[datetime, ContainerStatsOut]] = {}


def cpu_percent_from_stats(stats: dict) -> float | None:
    cpu = stats.get("cpu_stats") or {}
    previous = stats.get("precpu_stats") or {}
    cpu_total = (cpu.get("cpu_usage") or {}).get("total_usage")
    previous_total = (previous.get("cpu_usage") or {}).get("total_usage")
    system_total = cpu.get("system_cpu_usage")
    previous_system = previous.get("system_cpu_usage")
    if None in (cpu_total, previous_total, system_total, previous_system):
        return None
    system_delta = system_total - previous_system
    cpu_delta = cpu_total - previous_total
    if cpu_delta <= 0 or system_delta <= 0:
        return None
    online_cpus = (
        cpu.get("online_cpus") or len((cpu.get("cpu_usage") or {}).get("percpu_usage") or []) or 1
    )
    return round(cpu_delta / system_delta * online_cpus * 100, 1)


def memory_from_stats(stats: dict) -> tuple[int | None, int | None, float | None]:
    memory = stats.get("memory_stats") or {}
    usage = memory.get("usage")
    limit = memory.get("limit")
    if usage is None:
        return None, limit, None
    cache = (memory.get("stats") or {}).get("cache") or 0
    used = max(0, usage - cache)
    percent = round(used / limit * 100, 1) if limit else None
    return used, limit, percent


def read_container_stats(
    client: docker.DockerClient | None,
    names: list[str],
    *,
    now: datetime | None = None,
    force: bool = False,
) -> list[ContainerStatsOut]:
    if client is None:
        return [ContainerStatsOut(name=name) for name in names]
    reference = now or datetime.now(UTC).replace(tzinfo=None)
    results: list[ContainerStatsOut] = []
    for name in names:
        cached = _stats_cache.get(name)
        if cached is not None and not force and reference - cached[0] < STATS_CACHE_TTL:
            results.append(cached[1])
            continue
        try:
            raw = client.containers.get(name).stats(stream=False)
        except docker.errors.DockerException:
            stats = ContainerStatsOut(name=name)
        else:
            used, limit, percent = memory_from_stats(raw)
            stats = ContainerStatsOut(
                name=name,
                cpu_percent=cpu_percent_from_stats(raw),
                memory_used_bytes=used,
                memory_limit_bytes=limit,
                memory_percent=percent,
            )
        _stats_cache[name] = (reference, stats)
        results.append(stats)
    return results


def is_allowed_env(name: str) -> bool:
    upper = name.upper()
    if any(marker in upper for marker in SENSITIVE_MARKERS):
        return False
    return upper in ENV_ALLOWLIST or upper.startswith(ENV_ALLOWLIST_PREFIXES)


def filter_env(entries: list[str]) -> list[AppEnvVarOut]:
    variables: list[AppEnvVarOut] = []
    for entry in entries:
        name, _, value = entry.partition("=")
        if not name or not is_allowed_env(name):
            continue
        variables.append(AppEnvVarOut(name=name, value=value))
    return sorted(variables, key=lambda item: item.name)
