def test_system_requires_authentication(client):
    assert client.get("/api/v1/system/metrics").status_code == 401
    assert client.get("/api/v1/system/health").status_code == 401


def test_system_metrics(auth_client, fake_containers):
    from tests.conftest import FakeContainer

    fake_containers.append(FakeContainer(name="sonarr", health="healthy"))
    fake_containers.append(FakeContainer(name="radarr", state="exited"))

    response = auth_client.get("/api/v1/system/metrics")

    assert response.status_code == 200
    body = response.json()
    assert body["containers"]["total"] == 2
    assert body["containers"]["running"] == 1
    assert body["containers"]["healthy"] == 1
    assert body["containers"]["stopped"] == 1
    assert body["cpu_count"] == 4
    assert body["memory"]["total_bytes"] is not None
    assert body["disk"]["total_bytes"] is not None


def test_system_health(auth_client):
    response = auth_client.get("/api/v1/system/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    # Le client de test s'appelle "testserver" : pas de sonde DNS/TLS.
    assert body["dns"]["status"] == "unknown"
    assert body["tls"]["status"] == "unknown"
    keys = {service["key"] for service in body["services"]}
    assert {"docker", "ssdv2", "ssdv2ctl", "database", "backups", "jobs"} <= keys
    assert body["alerts"]["unread"] >= 0
