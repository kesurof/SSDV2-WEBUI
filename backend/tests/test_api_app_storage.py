import app.services.app_storage as app_storage


def test_app_storage_with_sizes(
    auth_client,
    write_catalogue,
    write_ssddb,
    write_registry,
    monkeypatch,
):
    write_catalogue("sonarr - Gestion Séries\n")
    write_ssddb([("sonarr", 2, "sonarr", 8989)], domain="exemple.tld")
    write_registry("sonarr", "volumes", ["sonarr-config", "sonarr-media"])
    monkeypatch.setattr(app_storage, "_cache", None)

    response = auth_client.get("/api/v1/apps/sonarr/storage")

    assert response.status_code == 200
    body = response.json()
    assert body["app"] == "sonarr"
    sizes = {volume["name"]: volume["size_bytes"] for volume in body["volumes"]}
    assert sizes == {"sonarr-config": 22 * 1024 * 1024, "sonarr-media": None}
    # Une taille inconnue rend le total inconnu.
    assert body["total_size_bytes"] is None


def test_app_storage_unknown_app(auth_client, write_catalogue):
    write_catalogue("sonarr - Gestion Séries\n")
    assert auth_client.get("/api/v1/apps/inconnue/storage").status_code == 404


def test_read_volume_usage_cache(monkeypatch):
    from datetime import datetime, timedelta

    from tests.conftest import FakeDockerClient

    monkeypatch.setattr(app_storage, "_cache", None)
    client = FakeDockerClient([])
    reference = datetime(2026, 9, 17, 12, 0, 0)
    first = app_storage.read_volume_usage(client, now=reference)
    assert first["sonarr-config"][0] == 22 * 1024 * 1024

    calls = {"count": 0}
    original = client.df

    def counting_df() -> dict:
        calls["count"] += 1
        return original()

    client.df = counting_df  # type: ignore[method-assign]

    # Dans la fenêtre de cache : aucun appel.
    app_storage.read_volume_usage(client, now=reference + timedelta(seconds=30))
    assert calls["count"] == 0

    # Après expiration, le cache est rafraîchi.
    app_storage.read_volume_usage(client, now=reference + timedelta(seconds=90))
    assert calls["count"] == 1
