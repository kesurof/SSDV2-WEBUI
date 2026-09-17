def test_health_endpoints(client):
    for path in ("/health", "/api/v1/health"):
        response = client.get(path)
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"status", "docker", "ssdv2", "database"}
        assert body["status"] in {"ok", "degraded"}
