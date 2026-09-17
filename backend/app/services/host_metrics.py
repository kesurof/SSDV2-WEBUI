import shutil
import time
from pathlib import Path

import docker

from app.core.config import Settings
from app.schemas.system import ContainerMetrics, DiskMetric, HostMetricsOut, MemoryMetric
from app.services.docker_state import DockerSnapshot

HOST_PROC_STAT = Path("/host/proc/stat")
HOST_PROC_MEMINFO = Path("/host/proc/meminfo")
FALLBACK_PROC_STAT = Path("/proc/stat")
FALLBACK_PROC_MEMINFO = Path("/proc/meminfo")
CPU_SAMPLE_SECONDS = 0.15


def parse_cpu_times(text: str) -> tuple[int, int] | None:
    """Compteurs CPU agrégés (total, idle+wait) depuis /proc/stat."""
    for line in text.splitlines():
        if not line.startswith("cpu "):
            continue
        fields = line.split()
        if len(fields) < 5:
            return None
        try:
            values = [int(value) for value in fields[1:]]
        except ValueError:
            return None
        total = sum(values)
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        return total, idle
    return None


def cpu_percent(first: tuple[int, int], second: tuple[int, int]) -> float | None:
    total_delta = second[0] - first[0]
    idle_delta = second[1] - first[1]
    if total_delta <= 0:
        return None
    busy = max(0, total_delta - idle_delta)
    return round(busy / total_delta * 100, 1)


def parse_memory(text: str) -> MemoryMetric:
    values: dict[str, int] = {}
    for line in text.splitlines():
        key, separator, rest = line.partition(":")
        if not separator:
            continue
        fields = rest.split()
        if not fields:
            continue
        try:
            values[key.strip()] = int(fields[0]) * 1024
        except ValueError:
            continue

    total = values.get("MemTotal")
    if not total:
        return MemoryMetric()
    available = values.get("MemAvailable")
    used = total - available if available is not None else values.get("MemFree")
    percent = round(used / total * 100, 1) if used is not None else None
    return MemoryMetric(total_bytes=total, used_bytes=used, percent=percent)


def container_metrics(snapshot: DockerSnapshot | None) -> ContainerMetrics:
    if snapshot is None:
        return ContainerMetrics()
    metrics = ContainerMetrics(total=len(snapshot.containers))
    for container in snapshot.containers:
        if container.state != "running":
            metrics.stopped += 1
            continue
        metrics.running += 1
        if container.health == "unhealthy":
            metrics.unhealthy += 1
        elif container.health == "healthy":
            metrics.healthy += 1
    return metrics


def read_metrics(
    settings: Settings,
    snapshot: DockerSnapshot | None,
    client: docker.DockerClient | None,
) -> HostMetricsOut:
    warnings: list[str] = []

    cpu: float | None = None
    stat_path = HOST_PROC_STAT if HOST_PROC_STAT.is_file() else FALLBACK_PROC_STAT
    try:
        first = parse_cpu_times(stat_path.read_text(encoding="utf-8"))
        if first is not None:
            time.sleep(CPU_SAMPLE_SECONDS)
            second = parse_cpu_times(stat_path.read_text(encoding="utf-8"))
            if second is not None:
                cpu = cpu_percent(first, second)
    except OSError:
        warnings.append("proc_unavailable")

    memory = MemoryMetric()
    meminfo_path = HOST_PROC_MEMINFO if HOST_PROC_MEMINFO.is_file() else FALLBACK_PROC_MEMINFO
    try:
        memory = parse_memory(meminfo_path.read_text(encoding="utf-8"))
    except OSError:
        warnings.append("proc_unavailable")

    disk = DiskMetric()
    try:
        usage = shutil.disk_usage(settings.ssdv2_storage)
        disk = DiskMetric(
            total_bytes=usage.total,
            used_bytes=usage.used,
            percent=round(usage.used / usage.total * 100, 1) if usage.total else None,
        )
    except OSError:
        warnings.append("storage_unavailable")

    cpu_count: int | None = None
    if client is None:
        warnings.append("docker_unavailable")
    else:
        try:
            cpu_count = client.info().get("NCPU")
        except docker.errors.DockerException:
            warnings.append("docker_unavailable")

    return HostMetricsOut(
        cpu_percent=cpu,
        cpu_count=cpu_count,
        memory=memory,
        disk=disk,
        containers=container_metrics(snapshot),
        warnings=sorted(set(warnings)),
    )
