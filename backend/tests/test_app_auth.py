import docker
import pytest

from app.services import app_auth
from app.services.docker_state import clear_docker_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_docker_cache()
    yield
    clear_docker_cache()


class FakeApi:
    def __init__(self) -> None:
        self.host_config: dict | None = None
        self.created: dict | None = None
        self.started: list[str] = []

    def create_host_config(self, **kwargs):
        self.host_config = kwargs
        return kwargs

    def create_container(self, image, **kwargs):
        self.created = {"image": image, **kwargs}
        return {"Id": "new-id"}

    def start(self, container_id: str) -> None:
        self.started.append(container_id)


class FakeContainer:
    def __init__(self, name: str, labels: dict[str, str], image: str = "app:latest"):
        self.name = name
        self.status = "running"
        self._labels = dict(labels)
        self._image = image
        self.stopped = False
        self.removed = False

    @property
    def labels(self) -> dict[str, str]:
        return dict(self._labels)

    @property
    def attrs(self) -> dict:
        return {
            "State": {"Status": "running"},
            "Created": "2026-01-01T00:00:00Z",
            "Image": "sha256:old",
            "Config": {
                "Image": self._image,
                "Labels": dict(self._labels),
                "Env": [],
                "Entrypoint": ["/init"],
                "ExposedPorts": {},
            },
            "HostConfig": {
                "NetworkMode": "traefik_proxy",
                "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
            },
            "Mounts": [],
        }

    def stop(self, timeout: int | None = None) -> None:
        self.stopped = True

    def remove(self) -> None:
        self.removed = True


class FakeContainers:
    def __init__(self, items: list[FakeContainer]) -> None:
        self._by = {item.name: item for item in items}

    def list(self, all: bool = False) -> list[FakeContainer]:
        return list(self._by.values())

    def get(self, name: str) -> FakeContainer:
        if name not in self._by:
            raise docker.errors.NotFound(name)
        return self._by[name]


class FakeClient:
    def __init__(self, items: list[FakeContainer]) -> None:
        self.containers = FakeContainers(items)
        self.api = FakeApi()


def test_auth_chain_mapping():
    assert app_auth.auth_chain("aucune") == "chain-no-auth@file"
    assert app_auth.auth_chain("basique") == "chain-basic-auth@file"
    assert app_auth.auth_chain("oauth") == "chain-oauth@file"
    assert app_auth.auth_chain("authelia") == "chain-authelia@file"
    assert app_auth.auth_chain("oauth2-proxy") == "chain-oauth2-proxy@file"
    assert app_auth.auth_chain("inconnu") == "chain-no-auth@file"


def test_middlewares_label():
    assert app_auth.middlewares_label("sonarr") == "traefik.http.routers.sonarr-rtr.middlewares"


def test_apply_app_auth_overrides_main_router_only(settings, write_registry):
    write_registry("sonarr", "containers", ["sonarr"])
    container = FakeContainer(
        "sonarr",
        {
            "traefik.enable": "true",
            "traefik.http.routers.sonarr-rtr.middlewares": "chain-oauth2-proxy@file",
            "traefik.http.routers.sonarr-rtr.rule": "Host(`sonarr.example.com`)",
            "traefik.http.routers.sonarr-bypass.middlewares": "chain-no-auth@file",
        },
    )
    client = FakeClient([container])
    events: list[str] = []

    code, message = app_auth.apply_app_auth(client, settings, "sonarr", "aucune", events.append)

    assert (code, message) == (0, None)
    assert container.stopped and container.removed
    created = client.api.created
    assert created is not None
    assert created["labels"]["traefik.http.routers.sonarr-rtr.middlewares"] == "chain-no-auth@file"
    assert created["labels"]["traefik.http.routers.sonarr-rtr.rule"] == "Host(`sonarr.example.com`)"
    # Le router secondaire (bypass) est conservé tel quel.
    bypass = created["labels"]["traefik.http.routers.sonarr-bypass.middlewares"]
    assert bypass == "chain-no-auth@file"
    assert created["labels"]["traefik.enable"] == "true"


def test_apply_app_auth_skips_container_without_label(settings, write_registry):
    write_registry("sonarr", "containers", ["sonarr-db"])
    container = FakeContainer("sonarr-db", {"com.example.role": "db"})
    client = FakeClient([container])
    events: list[str] = []

    code, message = app_auth.apply_app_auth(client, settings, "sonarr", "basique", events.append)

    assert code == 0
    assert not container.removed
    assert any("ignoré" in event for event in events)


def test_apply_app_auth_noop_when_already_applied(settings, write_registry):
    write_registry("sonarr", "containers", ["sonarr"])
    container = FakeContainer(
        "sonarr", {"traefik.http.routers.sonarr-rtr.middlewares": "chain-no-auth@file"}
    )
    client = FakeClient([container])

    code, _ = app_auth.apply_app_auth(client, settings, "sonarr", "aucune", lambda line: None)

    assert code == 0
    assert not container.removed


def test_apply_app_auth_reports_missing_containers(settings):
    client = FakeClient([])

    code, message = app_auth.apply_app_auth(client, settings, "ghost", "aucune", lambda line: None)

    assert code == 1
    assert message is not None and "ghost" in message
