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
