from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(frozen=True)
class BackupInfo:
    app: str
    file: str
    size: int
    created_at: datetime


def list_backups(backup_dir: Path) -> list[BackupInfo]:
    if not backup_dir.is_dir():
        return []
    items: list[BackupInfo] = []
    for app_dir in sorted(backup_dir.iterdir()):
        if not app_dir.is_dir():
            continue
        for archive in sorted(app_dir.glob("*.tar.gz")):
            stat = archive.stat()
            items.append(
                BackupInfo(
                    app=app_dir.name,
                    file=archive.name,
                    size=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC).replace(tzinfo=None),
                )
            )
    return sorted(items, key=lambda item: item.created_at, reverse=True)
