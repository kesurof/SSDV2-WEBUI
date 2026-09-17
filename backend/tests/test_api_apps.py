def test_apps_requires_authentication(client):
    assert client.get("/api/v1/apps").status_code == 401


def test_apps_aggregation(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    fake_containers,
):
    write_catalogue("sonarr - Gestion Séries\nradarr - Gestion Films\nwallos - Budget\n")
    write_ssddb(
        [
            ("sonarr", 2, "sonarr", 8989),
            ("radarr", 2, "radarr", 7878),
        ],
        domain="example.com",
    )
    write_registry("sonarr", "containers", ["sonarr"])
    write_registry("radarr", "containers", ["radarr"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr", health="healthy"))
    fake_containers.append(FakeContainer(name="radarr", state="exited"))

    response = auth_client.get("/api/v1/apps")

    assert response.status_code == 200
    states = {app["name"]: app for app in response.json()}
    assert set(states) == {"sonarr", "radarr", "wallos"}

    assert states["sonarr"]["installed"] is True
    assert states["sonarr"]["runtime_status"] == "running"
    assert states["sonarr"]["healthy"] is True
    assert states["sonarr"]["url"] == "https://sonarr.example.com"

    assert states["radarr"]["runtime_status"] == "stopped"

    assert states["wallos"]["installed"] is False
    assert states["wallos"]["runtime_status"] == "not_installed"


def test_apps_warns_when_ssddb_unreadable(
    auth_client,
    write_catalogue,
    write_ssddb,
    settings,
):
    write_catalogue("wallos - Budget\n")
    write_ssddb([], domain=None)
    settings.ssddb_file.write_text("pas une base sqlite", encoding="utf-8")

    response = auth_client.get("/api/v1/apps")

    assert response.status_code == 200
    assert "ssddb_unavailable" in response.json()[0]["warnings"]


def test_app_detail_requires_authentication(client):
    assert client.get("/api/v1/apps/sonarr").status_code == 401


def test_app_detail(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    fake_containers,
):
    write_catalogue("sonarr - Gestion Séries\nwallos - Budget\n")
    write_ssddb([("sonarr", 2, "sonarr", 8989)], domain="example.com")
    write_registry("sonarr", "containers", ["sonarr", "db-sonarr"])
    write_registry("sonarr", "volumes", ["sonarr-config"])
    write_registry("sonarr", "dns", ["sonarr.example.com"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr", health="healthy"))
    fake_containers.append(FakeContainer(name="db-sonarr", state="exited", image="postgres:16"))

    response = auth_client.get("/api/v1/apps/sonarr")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "sonarr"
    assert body["runtime_status"] == "partial"
    assert body["url"] == "https://sonarr.example.com"
    assert body["ssddb"] == {"status": 2, "subdomain": "sonarr", "port": 8989}
    assert body["registries"]["volumes"] == ["sonarr-config"]
    assert body["registries"]["dns"] == ["sonarr.example.com"]
    assert [
        (container["name"], container["state"], container["health"])
        for container in body["container_list"]
    ] == [("db-sonarr", "exited", None), ("sonarr", "running", "healthy")]


def test_app_detail_unknown_app(auth_client, write_catalogue):
    write_catalogue("wallos - Budget\n")

    response = auth_client.get("/api/v1/apps/sonarr")

    assert response.status_code == 404
    assert "inconnue" in response.json()["detail"]


def test_app_logs_requires_authentication(client):
    assert client.get("/api/v1/apps/sonarr/logs").status_code == 401


def test_app_logs_default_container(auth_client, write_catalogue, write_registry, fake_containers):
    write_catalogue("sonarr - Gestion Séries\n")
    write_registry("sonarr", "containers", ["sonarr", "db-sonarr"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr"))
    fake_containers.append(FakeContainer(name="db-sonarr"))

    response = auth_client.get("/api/v1/apps/sonarr/logs")

    assert response.status_code == 200
    body = response.json()
    assert body["container"] == "sonarr"
    assert len(body["lines"]) == 2
    assert body["lines"][0].endswith("ligne 1 de sonarr")


def test_app_logs_explicit_container(auth_client, write_catalogue, write_registry, fake_containers):
    write_catalogue("sonarr - Gestion Séries\n")
    write_registry("sonarr", "containers", ["sonarr", "db-sonarr"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr"))
    fake_containers.append(FakeContainer(name="db-sonarr"))

    response = auth_client.get("/api/v1/apps/sonarr/logs?container=db-sonarr&lines=1")

    assert response.status_code == 200
    body = response.json()
    assert body["container"] == "db-sonarr"
    assert body["lines"] == ["2026-09-17T10:00:01Z ligne 1 de db-sonarr"]


def test_app_logs_rejects_foreign_container(
    auth_client, write_catalogue, write_registry, fake_containers
):
    write_catalogue("sonarr - Gestion Séries\n")
    write_registry("sonarr", "containers", ["sonarr"])

    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr"))

    response = auth_client.get("/api/v1/apps/sonarr/logs?container=traefik")

    assert response.status_code == 404
    assert "non rattaché" in response.json()["detail"]


def test_app_logs_unknown_app(auth_client, write_catalogue):
    write_catalogue("wallos - Budget\n")

    assert auth_client.get("/api/v1/apps/sonarr/logs").status_code == 404


def test_app_logs_without_containers(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")

    response = auth_client.get("/api/v1/apps/sonarr/logs")

    assert response.status_code == 404
    assert "aucun conteneur" in response.json()["detail"]


def test_app_logs_without_docker(auth_client, write_catalogue):
    from app.deps import get_docker_client
    from app.main import app

    write_catalogue("sonarr - Gestion Séries\n")
    app.dependency_overrides[get_docker_client] = lambda: None

    assert auth_client.get("/api/v1/apps/sonarr/logs").status_code == 503
