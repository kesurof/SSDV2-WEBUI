from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.gzip import GZipMiddleware

from app.main import _mount_frontend

ASSET_PAYLOAD = b"x" * 4096


def _build_app(dist, monkeypatch) -> FastAPI:
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (assets / "app-abc123.js").write_bytes(ASSET_PAYLOAD)
    (dist / "index.html").write_text("<!doctype html><title>SSDV2</title>", encoding="utf-8")

    app = FastAPI()
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)
    monkeypatch.setattr("app.main.get_settings", lambda: SimpleNamespace(static_dir=dist))
    _mount_frontend(app)
    return app


def test_hashed_assets_are_immutable(tmp_path, monkeypatch) -> None:
    with TestClient(_build_app(tmp_path, monkeypatch)) as client:
        response = client.get("/assets/app-abc123.js")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_assets_are_gzipped(tmp_path, monkeypatch) -> None:
    with TestClient(_build_app(tmp_path, monkeypatch)) as client:
        response = client.get("/assets/app-abc123.js", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers.get("content-encoding") == "gzip"
    assert response.content == ASSET_PAYLOAD


def test_index_html_is_not_cached(tmp_path, monkeypatch) -> None:
    with TestClient(_build_app(tmp_path, monkeypatch)) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"


def test_sse_stream_is_not_compressed(auth_client: TestClient) -> None:
    response = auth_client.get(
        "/api/v1/notifications/events?once=true", headers={"Accept-Encoding": "gzip"}
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers.get("content-encoding") != "gzip"
