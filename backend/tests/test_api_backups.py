from pathlib import Path

from app.services.backups import list_backups

ARCHIVE = "sonarr-20260917-1200.tar.gz"


def write_backup(settings, app: str, name: str, content: str = "x" * 10) -> Path:
    directory = settings.backup_dir / app
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    path.write_text(content, encoding="utf-8")
    return path


def test_list_backups_missing_dir(tmp_path):
    assert list_backups(tmp_path / "absent") == []


def test_backups_requires_authentication(client):
    assert client.get("/api/v1/backups").status_code == 401


def test_backups_list(auth_client, settings):
    old = write_backup(settings, "sonarr", "sonarr-20260916-1200.tar.gz")
    new = write_backup(settings, "sonarr", ARCHIVE, content="x" * 42)
    write_backup(settings, "radarr", "radarr-20260917-1300.tar.gz")
    (settings.backup_dir / "notes.txt").write_text("ignore", encoding="utf-8")

    response = auth_client.get("/api/v1/backups")

    assert response.status_code == 200
    items = response.json()
    assert [item["file"] for item in items] == [
        "radarr-20260917-1300.tar.gz",
        "sonarr-20260917-1200.tar.gz",
        "sonarr-20260916-1200.tar.gz",
    ]
    sonarr = next(item for item in items if item["file"] == ARCHIVE)
    assert sonarr["app"] == "sonarr"
    assert sonarr["size"] == new.stat().st_size

    old.unlink()
    new.unlink()
    (settings.backup_dir / "radarr" / "radarr-20260917-1300.tar.gz").unlink()
    (settings.backup_dir / "notes.txt").unlink()
