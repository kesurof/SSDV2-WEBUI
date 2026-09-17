from tests.conftest import login_payload


def test_me_requires_authentication(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_invalid_credentials(client):
    response = client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    assert response.status_code == 401


def test_login_logout_flow(client):
    response = client.post("/api/v1/auth/login", json=login_payload())
    assert response.status_code == 200
    assert response.json() == {"username": "admin", "internal_auth": True}
    assert client.get("/api/v1/auth/me").json() == {
        "username": "admin",
        "internal_auth": True,
    }

    csrf = client.cookies.get("ssdv2_webui_csrf")
    assert csrf

    assert client.post("/api/v1/auth/logout").status_code == 403
    response = client.post("/api/v1/auth/logout", headers={"x-csrf-token": csrf})
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_rate_limited(client):
    for _ in range(5):
        client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    response = client.post("/api/v1/auth/login", json=login_payload("mauvais"))
    assert response.status_code == 429
