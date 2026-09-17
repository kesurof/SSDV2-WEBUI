import docker

from app.schemas.app import AppStateOut
from app.services import updates as updates_service


class FakeImage:
    def __init__(self, digest: str | None) -> None:
        self.attrs = {
            "RepoDigests": [f"repo/app@{digest}"] if digest else [],
        }


class FakeImages:
    def __init__(self, local: dict[str, str], remote: dict[str, str]) -> None:
        self._local = local
        self._remote = remote

    def get(self, reference: str) -> FakeImage:
        if reference not in self._local:
            raise docker.errors.ImageNotFound(reference)
        return FakeImage(self._local[reference])

    def get_registry_data(self, reference: str):
        if reference not in self._remote:
            raise docker.errors.DockerException("registre indisponible")
        return type("RegistryData", (), {"id": self._remote[reference]})()


class FakeClient:
    def __init__(self, images: FakeImages) -> None:
        self.images = images


def _state(name: str, image: str | None) -> AppStateOut:
    return AppStateOut(
        name=name,
        description="",
        available=True,
        installed=True,
        runtime_status="running",
        healthy=True,
        url=None,
        image=image,
        containers=1,
        warnings=[],
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
