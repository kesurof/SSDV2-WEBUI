import re
from collections import Counter
from pathlib import Path

import docker

from app.core.config import Settings
from app.schemas.app import AppStateOut
from app.schemas.system import HostSummary, Ssdv2Summary, SystemSummaryOut

COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")


def _read_ref(git_dir: Path, ref: str) -> str | None:
    ref_file = git_dir / ref
    try:
        if ref_file.is_file():
            value = ref_file.read_text(encoding="utf-8").strip()
            return value if COMMIT_PATTERN.match(value) else None
        packed = git_dir / "packed-refs"
        if packed.is_file():
            for line in packed.read_text(encoding="utf-8").splitlines():
                if not line.strip() or line.startswith("#"):
                    continue
                sha, _, name = line.partition(" ")
                if name.strip() == ref and COMMIT_PATTERN.match(sha):
                    return sha
    except OSError:
        return None
    return None


def read_git_info(source: Path) -> tuple[str | None, str | None]:
    head = source / ".git" / "HEAD"
    if not head.is_file():
        return None, None
    try:
        content = head.read_text(encoding="utf-8").strip()
    except OSError:
        return None, None

    if content.startswith("ref: "):
        ref = content.removeprefix("ref: ").strip()
        branch = ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else None
        return branch, _read_ref(source / ".git", ref)
    if COMMIT_PATTERN.match(content):
        return None, content
    return None, None


def collect_host_summary(client: docker.DockerClient | None) -> HostSummary:
    if client is None:
        return HostSummary()
    try:
        info = client.info()
    except (docker.errors.DockerException, AttributeError):
        return HostSummary()
    return HostSummary(
        hostname=info.get("Name"),
        os=info.get("OperatingSystem"),
        kernel=info.get("KernelVersion"),
        architecture=info.get("Architecture"),
        cpus=info.get("NCPU"),
        memory_bytes=info.get("MemTotal"),
        server_version=info.get("ServerVersion"),
    )


def build_summary(
    settings: Settings,
    states: list[AppStateOut],
    client: docker.DockerClient | None,
) -> SystemSummaryOut:
    host = collect_host_summary(client)
    branch, commit = read_git_info(settings.ssdv2_source)
    statuses = Counter(state.runtime_status for state in states)

    warnings: list[str] = []
    if host.hostname is None:
        warnings.append("docker_unavailable")
    if not states:
        warnings.append("catalogue_unavailable")

    return SystemSummaryOut(
        status="degraded" if warnings else "ok",
        host=host,
        ssdv2=Ssdv2Summary(
            branch=branch,
            commit=commit,
            apps_total=len(states),
            installed=sum(1 for state in states if state.installed),
            running=statuses["running"],
            stopped=statuses["stopped"],
            unknown=statuses["unknown"],
            not_installed=statuses["not_installed"],
        ),
        warnings=warnings,
    )
