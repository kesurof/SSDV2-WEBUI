import os
import sqlite3
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import docker
import pytest
from fastapi.testclient import TestClient

_TMP = Path(tempfile.mkdtemp(prefix="ssdv2-webui-tests-"))
_SOURCE = _TMP / "ssdv2-source"
_STORAGE = _TMP / "ssdv2-storage"
_DATA = _TMP / "webui-data"

TEST_ADMIN_USER = "admin"
TEST_ADMIN_PASSWORD = "test-password"


def login_payload(password: str = TEST_ADMIN_PASSWORD) -> dict[str, str]:
    return {"username": TEST_ADMIN_USER, "password": password}


def pytest_configure(config: pytest.Config) -> None:
    (_SOURCE / "includes" / "config").mkdir(parents=True, exist_ok=True)
    (_STORAGE / "conf").mkdir(parents=True, exist_ok=True)
    _DATA.mkdir(parents=True, exist_ok=True)
    os.environ["SSDV2_SOURCE"] = str(_SOURCE)
    os.environ["SSDV2_STORAGE"] = str(_STORAGE)
    os.environ["WEBUI_DATA"] = str(_DATA)
    os.environ["WEBUI_ADMIN_USER"] = "admin"
    os.environ["WEBUI_ADMIN_PASSWORD"] = "test-password"

    from app.core.config import get_settings
    from app.db.session import get_engine, get_session_factory

    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@dataclass
class FakeContainer:
    name: str
    state: str = "running"
    health: str | None = None
    app_label: str | None = None
    image: str = "example/image:latest"

    @property
    def status(self) -> str:
        return self.state

    @property
    def labels(self) -> dict[str, str]:
        return {"ssdv2.app": self.app_label} if self.app_label else {}

    @property
    def attrs(self) -> dict:
        state: dict = {"Status": self.state}
        if self.health:
            state["Health"] = {"Status": self.health}
        return {"State": state, "Config": {"Image": self.image, "Labels": self.labels}}

    def logs(
        self,
        tail: int = 200,
        timestamps: bool = False,
        stream: bool = False,
        follow: bool = False,
    ):
        lines = [
            f"2026-09-17T10:00:0{index}Z ligne {index} de {self.name}" for index in range(1, 3)
        ][:tail]
        if stream:
            return iter([f"{line}\n".encode() for line in lines])
        return ("\n".join(lines) + "\n").encode("utf-8")


class FakeContainers:
    def __init__(self, containers: list[FakeContainer]) -> None:
        self._containers = containers

    def list(self, all: bool = False) -> list[FakeContainer]:
        return self._containers

    def get(self, name: str) -> FakeContainer:
        for container in self._containers:
            if container.name == name:
                return container
        raise docker.errors.NotFound(f"conteneur introuvable: {name}")


class FakeDockerClient:
    def __init__(self, containers: list[FakeContainer]) -> None:
        self.containers = FakeContainers(containers)

    def info(self) -> dict:
        return {
            "Name": "test-host",
            "OperatingSystem": "Test OS",
            "KernelVersion": "6.0.0-test",
            "Architecture": "aarch64",
            "NCPU": 4,
            "MemTotal": 8_000_000_000,
            "ServerVersion": "29.0.0",
        }


@pytest.fixture(scope="session")
def settings():
    from app.core.config import get_settings

    return get_settings()


@pytest.fixture
def fake_containers() -> list[FakeContainer]:
    return []


@pytest.fixture
def client(fake_containers: list[FakeContainer]) -> Iterator[TestClient]:
    from app.api.auth import login_limiter
    from app.deps import get_docker_client
    from app.main import app

    login_limiter()._attempts.clear()
    app.dependency_overrides[get_docker_client] = lambda: FakeDockerClient(fake_containers)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    response = client.post("/api/v1/auth/login", json=login_payload())
    assert response.status_code == 200
    return client


@pytest.fixture
def write_catalogue(settings) -> Iterator[object]:
    def _write(text: str) -> Path:
        path = settings.catalogue_file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    yield _write
    settings.catalogue_file.unlink(missing_ok=True)


@pytest.fixture
def write_registry(settings) -> Iterator[object]:
    def _write(app: str, kind: str, values: list[str]) -> Path:
        settings.registries_dir.mkdir(parents=True, exist_ok=True)
        path = settings.registries_dir / f"{app}.{kind}"
        path.write_text("\n".join(values) + "\n", encoding="utf-8")
        return path

    yield _write
    for file in settings.registries_dir.glob("*.containers"):
        file.unlink(missing_ok=True)
    for kind in ("volumes", "dns"):
        for file in settings.registries_dir.glob(f"*.{kind}"):
            file.unlink(missing_ok=True)


@pytest.fixture
def write_ssddb(settings) -> Iterator[object]:
    def _write(
        applications: list[tuple[str, int, str, int]], domain: str | None = "example.com"
    ) -> Path:
        path = settings.ssddb_file
        path.unlink(missing_ok=True)
        with sqlite3.connect(path) as conn:
            conn.execute(
                "create table applications("
                "name varchar(50) primary key, status integer, "
                "subdomain varchar(50), port integer)"
            )
            conn.execute(
                "create table seedbox_params(param varchar(50) primary key, value varchar(50))"
            )
            if domain:
                conn.execute("insert into seedbox_params values ('domain', ?)", (domain,))
            conn.executemany("insert into applications values (?, ?, ?, ?)", applications)
        return path

    yield _write
    settings.ssddb_file.unlink(missing_ok=True)
