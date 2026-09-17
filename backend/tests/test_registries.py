from app.services.registries import read_registries


def test_read_registries(tmp_path):
    (tmp_path / "sonarr.containers").write_text("sonarr\nsonarr-db\n", encoding="utf-8")
    (tmp_path / "sonarr.volumes").write_text("sonarr-config\n", encoding="utf-8")
    (tmp_path / "sonarr.dns").write_text("sonarr.example.com\n", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("ignore", encoding="utf-8")

    registries = read_registries(tmp_path)

    assert set(registries) == {"sonarr"}
    assert registries["sonarr"].containers == ["sonarr", "sonarr-db"]
    assert registries["sonarr"].volumes == ["sonarr-config"]
    assert registries["sonarr"].dns == ["sonarr.example.com"]


def test_read_registries_missing_dir(tmp_path):
    assert read_registries(tmp_path / "absent") == {}
