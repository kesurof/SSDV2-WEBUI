import app.services.app_stats as app_stats
from tests.conftest import FakeContainer


def _install_dozzle(write_catalogue, write_ssddb, write_registry) -> None:
    write_catalogue("dozzle - Visualisation des logs\n")
    write_ssddb([("dozzle", 2, "dozzle", 8080)], domain="exemple.tld")
    write_registry("dozzle", "containers", ["dozzle"])


def test_app_env_allowlist(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    fake_containers,
):
    _install_dozzle(write_catalogue, write_ssddb, write_registry)
    fake_containers.append(
        FakeContainer(
            name="dozzle",
            env=[
                "TZ=Europe/Paris",
                "PUID=1000",
                "DOZZLE_LEVEL=info",
                "DB_PASSWORD=secret",
                "API_TOKEN=abc",
                "VAULT_PASS=xyz",
                "MY_SECRET_KEY=123",
            ],
        )
    )

    response = auth_client.get("/api/v1/apps/dozzle/env")

    assert response.status_code == 200
    variables = {item["name"]: item["value"] for item in response.json()["variables"]}
    assert variables == {
        "TZ": "Europe/Paris",
        "PUID": "1000",
        "DOZZLE_LEVEL": "info",
    }


def test_app_env_unknown_app(auth_client, write_catalogue):
    write_catalogue("dozzle - Visualisation des logs\n")
    assert auth_client.get("/api/v1/apps/inconnue/env").status_code == 404


def test_app_stats(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    fake_containers,
    monkeypatch,
):
    _install_dozzle(write_catalogue, write_ssddb, write_registry)
    fake_containers.append(FakeContainer(name="dozzle"))
    monkeypatch.setattr(app_stats, "_stats_cache", {})

    response = auth_client.get("/api/v1/apps/dozzle/stats")

    assert response.status_code == 200
    containers = response.json()["containers"]
    assert len(containers) == 1
    assert containers[0]["name"] == "dozzle"
    assert containers[0]["cpu_percent"] == 20.0
    assert containers[0]["memory_used_bytes"] == 100 * 1024 * 1024
    assert containers[0]["memory_percent"] == 20.0
