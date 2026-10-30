import docker

from app.schemas.app import AppStateOut
from app.services import updates as updates_service


class FakeImage:
    def __init__(self, digest: str | None, image_id: str = "sha256:tag") -> None:
        self.id = image_id
        self.attrs = {
            "RepoDigests": [f"repo/app@{digest}"] if digest else [],
        }


class FakeImages:
    def __init__(
        self,
        local: dict[str, str],
        remote: dict[str, str],
        image_ids: dict[str, str] | None = None,
    ) -> None:
        self._local = local
        self._remote = remote
        self._image_ids = image_ids or {}

    def get(self, reference: str) -> FakeImage:
        if reference not in self._local:
            raise docker.errors.ImageNotFound(reference)
        return FakeImage(
            self._local[reference],
            self._image_ids.get(reference, f"sha256:{reference}"),
        )

    def get_registry_data(self, reference: str):
        if reference not in self._remote:
            raise docker.errors.DockerException("registre indisponible")
        return type("RegistryData", (), {"id": self._remote[reference]})()


class FakeClient:
    def __init__(self, images: FakeImages) -> None:
        self.images = images


def _state(
    name: str,
    image: str | None,
    running_image_ids: dict[str, list[str]] | None = None,
) -> AppStateOut:
    return AppStateOut(
        name=name,
        description="",
        available=True,
        installed=True,
        runtime_status="running",
        healthy=True,
        url=None,
        domain=None,
        image=image,
        containers=1,
        warnings=[],
        running_image_ids=running_image_ids or {},
    )


def test_short_digest():
    assert updates_service.short_digest("sha256:abcdef1234567890") == "abcdef123456"
    assert updates_service.short_digest(None) is None


def test_build_updates_statuses(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    states = [
        _state("a", "repo/a:latest"),
        _state("b", "repo/b:latest"),
        _state("c", "repo/c:latest"),
    ]
    client = FakeClient(
        FakeImages(
            local={"repo/a:latest": "sha256:aaa", "repo/b:latest": "sha256:bbb"},
            remote={"repo/a:latest": "sha256:aaa", "repo/b:latest": "sha256:ccc"},
        )
    )

    result = updates_service.build_updates(states, client)

    statuses = {entry.app: entry.status for entry in result.entries}
    assert statuses == {"a": "up_to_date", "b": "available", "c": "unknown"}
    assert result.available == 1
    assert result.entries[0].app == "b"


def test_build_updates_ignores_not_installed(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state("x", None)
    result = updates_service.build_updates([state], None)
    assert result.entries == []


def test_updates_endpoint(auth_client):
    response = auth_client.get("/api/v1/updates")
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == 1
    assert isinstance(body["entries"], list)
    assert all("running_image_ids" not in entry for entry in body["entries"])


def test_build_updates_force_respects_min_interval(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    states = [_state("a", "repo/a:latest")]
    client = FakeClient(
        FakeImages(
            local={"repo/a:latest": "sha256:aaa"},
            remote={"repo/a:latest": "sha256:aaa"},
        )
    )
    first = updates_service.build_updates(states, client)

    calls = {"count": 0}
    original = client.images.get_registry_data

    def counting_registry(reference: str):
        calls["count"] += 1
        return original(reference)

    client.images.get_registry_data = counting_registry  # type: ignore[method-assign]

    # Rafraîchissement forcé trop rapproché : le cache est renvoyé sans appel registre.
    second = updates_service.build_updates(states, client, force=True)
    assert calls["count"] == 0
    assert second.checked_at == first.checked_at


def test_build_updates_detects_stale_container(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state(
        "a",
        "repo/a:latest",
        running_image_ids={"repo/a:latest": ["sha256:old"]},
    )
    client = FakeClient(
        FakeImages(
            local={"repo/a:latest": "sha256:new", "sha256:old": "sha256:old"},
            remote={"repo/a:latest": "sha256:new"},
            image_ids={"repo/a:latest": "sha256:new"},
        )
    )

    result = updates_service.build_updates([state], client)

    entry = result.entries[0]
    assert entry.status == "available"
    assert entry.needs_recreate is True
    assert entry.current_digest == "old"
    assert entry.available_digest == "new"
    assert result.available == 1


def test_build_updates_stale_container_without_registry(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state(
        "a",
        "repo/a:latest",
        running_image_ids={"repo/a:latest": ["sha256:old"]},
    )
    client = FakeClient(
        FakeImages(
            local={"repo/a:latest": "sha256:new", "sha256:old": "sha256:old"},
            remote={},
            image_ids={"repo/a:latest": "sha256:new"},
        )
    )

    result = updates_service.build_updates([state], client)

    entry = result.entries[0]
    assert entry.status == "available"
    assert entry.needs_recreate is True
    assert entry.available_digest == "new"


def test_build_updates_ignores_companion_image(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state(
        "a",
        "repo/a:latest",
        running_image_ids={
            "repo/a:latest": ["sha256:same"],
            "repo/companion:latest": ["sha256:other"],
        },
    )
    client = FakeClient(
        FakeImages(
            local={
                "repo/a:latest": "sha256:same",
                "repo/companion:latest": "sha256:other",
            },
            remote={"repo/a:latest": "sha256:same"},
            image_ids={
                "repo/a:latest": "sha256:same",
                "repo/companion:latest": "sha256:other",
            },
        )
    )

    result = updates_service.build_updates([state], client)

    entry = result.entries[0]
    assert entry.status == "up_to_date"
    assert entry.needs_recreate is False


def test_build_updates_compares_registry_when_tag_missing(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state(
        "a",
        "repo/a:latest",
        running_image_ids={"repo/a:latest": ["sha256:old"]},
    )
    client = FakeClient(
        FakeImages(
            local={"sha256:old": "sha256:old"},
            remote={"repo/a:latest": "sha256:new"},
        )
    )

    result = updates_service.build_updates([state], client)

    entry = result.entries[0]
    assert entry.status == "available"
    assert entry.needs_recreate is False
    assert entry.current_digest == "old"
    assert entry.available_digest == "new"


def test_build_updates_registry_newer_than_local_tag(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", None)
    state = _state(
        "a",
        "repo/a:latest",
        running_image_ids={"repo/a:latest": ["sha256:old"]},
    )
    client = FakeClient(
        FakeImages(
            local={"repo/a:latest": "sha256:new", "sha256:old": "sha256:old"},
            remote={"repo/a:latest": "sha256:newer"},
            image_ids={"repo/a:latest": "sha256:new"},
        )
    )

    result = updates_service.build_updates([state], client)

    entry = result.entries[0]
    assert entry.status == "available"
    assert entry.needs_recreate is False
    assert entry.current_digest == "old"
    assert entry.available_digest == "newer"


def test_clear_cache(monkeypatch):
    monkeypatch.setattr(updates_service, "_cache", ("cache", []))
    updates_service.clear_cache()
    assert updates_service._cache is None
