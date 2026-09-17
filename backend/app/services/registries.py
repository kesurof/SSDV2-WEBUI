from dataclasses import dataclass, field
from pathlib import Path

SUFFIXES = ("containers", "volumes", "dns")


@dataclass
class Registry:
    containers: list[str] = field(default_factory=list)
    volumes: list[str] = field(default_factory=list)
    dns: list[str] = field(default_factory=list)


def read_registries(conf_dir: Path) -> dict[str, Registry]:
    registries: dict[str, Registry] = {}
    if not conf_dir.is_dir():
        return registries
    for file in sorted(conf_dir.iterdir()):
        if not file.is_file():
            continue
        kind = file.suffix.lstrip(".")
        if kind not in SUFFIXES:
            continue
        values = [
            line.strip() for line in file.read_text(encoding="utf-8").splitlines() if line.strip()
        ]
        registry = registries.setdefault(file.stem, Registry())
        setattr(registry, kind, values)
    return registries
