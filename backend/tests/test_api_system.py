from app.services.system import read_git_info


def test_read_git_info(tmp_path):
    git_dir = tmp_path / ".git"
    (git_dir / "refs" / "heads").mkdir(parents=True)
    (git_dir / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
    sha = "a" * 40
    (git_dir / "refs" / "heads" / "main").write_text(sha + "\n", encoding="utf-8")

    assert read_git_info(tmp_path) == ("main", sha)


def test_read_git_info_detached_head(tmp_path):
    git_dir = tmp_path / ".git"
    git_dir.mkdir()
    sha = "b" * 40
    (git_dir / "HEAD").write_text(sha + "\n", encoding="utf-8")

    assert read_git_info(tmp_path) == (None, sha)


def test_read_git_info_packed_refs(tmp_path):
    git_dir = tmp_path / ".git"
    git_dir.mkdir()
    (git_dir / "HEAD").write_text("ref: refs/heads/dev\n", encoding="utf-8")
    sha = "c" * 40
    (git_dir / "packed-refs").write_text(
        f"# pack-refs with: peeled fully-peeled sorted\n{sha} refs/heads/dev\n",
        encoding="utf-8",
    )

    assert read_git_info(tmp_path) == ("dev", sha)


def test_read_git_info_missing(tmp_path):
    assert read_git_info(tmp_path) == (None, None)


def test_system_summary_requires_authentication(client):
    assert client.get("/api/v1/system/summary").status_code == 401


def test_system_summary(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    fake_containers,
):
    write_catalogue("sonarr - Gestion Séries\nradarr - Gestion Films\nwallos - Budget\n")
    write_ssddb(
        [("sonarr", 2, "sonarr", 8989), ("radarr", 2, "radarr", 7878)],
        domain="example.com",
    )
    write_registry("sonarr", "containers", ["sonarr"])
    write_registry("radarr", "containers", ["radarr"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr", health="healthy"))
    fake_containers.append(FakeContainer(name="radarr", state="exited"))

    response = auth_client.get("/api/v1/system/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["host"]["hostname"] == "test-host"
    assert body["host"]["cpus"] == 4
    assert body["ssdv2"]["apps_total"] == 3
    assert body["ssdv2"]["installed"] == 2
    assert body["ssdv2"]["running"] == 1
    assert body["ssdv2"]["stopped"] == 1
    assert body["ssdv2"]["not_installed"] == 1
    assert body["warnings"] == []


def test_system_summary_without_catalogue(auth_client):
    response = auth_client.get("/api/v1/system/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert "catalogue_unavailable" in body["warnings"]
