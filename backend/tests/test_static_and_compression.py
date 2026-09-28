import json
import time
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
    (assets / "logo-abc123.png").write_bytes(ASSET_PAYLOAD)
    (assets / "font-abc123.woff2").write_bytes(ASSET_PAYLOAD)
    (dist / "index.html").write_text("<!doctype html><title>SSDV2</title>", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")

    app = FastAPI()
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)
    monkeypatch.setattr("app.main.get_settings", lambda: SimpleNamespace(static_dir=dist))
    _mount_frontend(app)
    return app


def _iter_sse_lines(chunks, timeout: float = 5.0):
    """Extrait les lignes `data:` au fil de l'eau, sans bufferiser tout le flux."""
    buffer = ""
    deadline = time.monotonic() + timeout
    for chunk in chunks:
        buffer += chunk
        while "\n" in buffer:
            line, _, buffer = buffer.partition("\n")
            if line.startswith("data: "):
                yield json.loads(line[len("data: ") :])
        if time.monotonic() > deadline:
            raise AssertionError("flux SSE trop lent ou bufferisé")


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


def test_precompressed_assets_are_not_gzipped(tmp_path, monkeypatch) -> None:
    with TestClient(_build_app(tmp_path, monkeypatch)) as client:
        png = client.get("/assets/logo-abc123.png", headers={"Accept-Encoding": "gzip"})
        woff2 = client.get("/assets/font-abc123.woff2", headers={"Accept-Encoding": "gzip"})

    assert png.status_code == 200
    assert png.headers.get("content-encoding") != "gzip"
    assert woff2.status_code == 200
    assert woff2.headers.get("content-encoding") != "gzip"


def test_spa_fallback_files_are_not_cached(tmp_path, monkeypatch) -> None:
    with TestClient(_build_app(tmp_path, monkeypatch)) as client:
        svg = client.get("/favicon.svg")
        fallback = client.get("/dashboard")

    assert svg.status_code == 200
    assert svg.headers["cache-control"] == "no-cache"
    assert fallback.status_code == 200
    assert fallback.headers["cache-control"] == "no-cache"


def test_sse_stream_is_not_compressed(auth_client: TestClient) -> None:
    response = auth_client.get(
        "/api/v1/notifications/events?once=true", headers={"Accept-Encoding": "gzip"}
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers.get("content-encoding") != "gzip"


def test_job_events_stream_is_incremental(auth_client: TestClient, write_catalogue) -> None:
    from app.services.jobs import job_manager
    from tests.conftest import FakeStreamingRunner

    write_catalogue("sonarr - Gestion Séries\n")
    runner = FakeStreamingRunner(lines=("ligne de job",))
    job_manager.configure(lambda: runner)

    response = auth_client.post("/api/v1/apps/sonarr/start")
    job_id = response.json()["id"]

    with auth_client.stream(
        "GET",
        f"/api/v1/jobs/{job_id}/events",
        headers={"Accept-Encoding": "gzip"},
    ) as stream:
        assert stream.status_code == 200
        assert stream.headers["content-type"].startswith("text/event-stream")
        assert stream.headers.get("content-encoding") != "gzip"
        payloads = list(_iter_sse_lines(stream.iter_text()))

    assert any(payload.get("done") and payload.get("status") == "success" for payload in payloads)
    assert any("line" in payload for payload in payloads)
