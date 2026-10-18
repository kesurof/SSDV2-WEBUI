import docker
import pytest

from app.services import app_update
from app.services.docker_state import clear_docker_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_docker_cache()
    yield
    clear_docker_cache()


class FakeUpdateContainer:
    def __init__(self, name: str, image: str = "example/app:latest", app_label: str | None = None):
        self.name = name
        self.status = "running"
        self.stopped = False
        self.removed = False
        self._image = image
        self._app_label = app_label or name

    @property
    def labels(self) -> dict[str, str]:
        return {"ssdv2.app": self._app_label}

    @property
    def attrs(self) -> dict:
        return {
            "State": {"Status": "running"},
            "Created": "2026-01-01T00:00:00Z",
            "Image": "sha256:old",
            "Config": {"Image": self._image, "Labels": self.labels},
        }

    def stop(self, timeout: int | None = None) -> None:
        self.stopped = True

    def remove(self) -> None:
        self.removed = True


class FakeUpdateImages:
    def __init__(self) -> None:
        self.pulled: list[str] = []
        self.fail: set[str] = set()

    def pull(self, reference: str):
        if reference in self.fail:
            raise docker.errors.DockerException("pull refusé")
        self.pulled.append(reference)
        return object()


class FakeUpdateContainers:
    def __init__(self, containers: list[FakeUpdateContainer]) -> None:
        self._by_name = {container.name: container for container in containers}

    def list(self, all: bool = False) -> list[FakeUpdateContainer]:
        return list(self._by_name.values())

    def get(self, name: str) -> FakeUpdateContainer:
        if name not in self._by_name:
            raise docker.errors.NotFound(f"introuvable: {name}")
        return self._by_name[name]


class FakeUpdateClient:
    def __init__(self, containers: list[FakeUpdateContainer]) -> None:
        self.containers = FakeUpdateContainers(containers)
        self.images = FakeUpdateImages()


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


class FakeRecreateClient:
    def __init__(self) -> None:
        self.api = FakeApi()


def _detailed_container():
    class Detailed:
        name = "plex"
        status = "running"

        @property
        def attrs(self) -> dict:
            return {
                "Config": {
                    "Image": "lscr.io/linuxserver/plex:latest",
                    "Env": ["PUID=0", "PGID=0", "TZ=Europe/Paris"],
                    "Cmd": None,
                    "Entrypoint": ["/init"],
                    "Labels": {"traefik.enable": "true"},
                    "ExposedPorts": {"32400/tcp": {}},
                    "User": "",
                    "WorkingDir": "",
                    "Domainname": "",
                    "StopSignal": "",
                    "Tty": False,
                    "Healthcheck": {"Test": ["CMD", "true"], "Interval": 30},
                },
                "HostConfig": {
                    "Binds": ["/mnt:/mnt:rslave"],
                    "PortBindings": {"32400/tcp": [{"HostIp": "0.0.0.0", "HostPort": "32400"}]},
                    "NetworkMode": "traefik_proxy",
                    "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
                    "LogConfig": {"Type": "json-file", "Config": {}},
                    "ShmSize": 67108864,
                    "ExtraHosts": ["metric.plex.tv:127.0.0.1"],
                },
                "Mounts": [
                    {
                        "Type": "volume",
                        "Source": "plex-config",
                        "Destination": "/config",
                        "RW": True,
                    },
                    {
                        "Type": "bind",
                        "Source": "/mnt",
                        "Destination": "/mnt",
                        "RW": True,
                    },
                ],
            }

        def stop(self, timeout: int | None = None) -> None:
            self.stopped = True

        def remove(self) -> None:
            self.removed = True

    return Detailed()


def test_recreate_container_preserves_config_and_overrides_env():
    client = FakeRecreateClient()
    container = _detailed_container()

    created_id = app_update.recreate_container(client, container, env_overrides={"PUID": "1002"})

    assert created_id == "new-id"
    assert container.stopped and container.removed
    assert client.api.started == ["new-id"]
    created = client.api.created
    assert created is not None
    assert created["name"] == "plex"
    assert created["image"] == "lscr.io/linuxserver/plex:latest"
    assert created["entrypoint"] == ["/init"]
    assert "PUID=1002" in created["environment"]
    assert "PUID=0" not in created["environment"]
    assert "PGID=0" in created["environment"]
    # Le volume nommé est réutilisé, pas le bind (déjà dans `binds`).
    mounts = client.api.host_config["mounts"]
    assert [mount["Target"] for mount in mounts] == ["/config"]
    assert client.api.host_config["network_mode"] == "traefik_proxy"
    assert client.api.host_config["port_bindings"]["32400/tcp"][0]["HostPort"] == "32400"
    assert created["healthcheck"]["test"] == ["CMD", "true"]


def test_app_container_names_matches_label_and_name(settings, write_registry):
    write_registry("plex", "containers", ["plex", "plex-helper"])
    client = FakeUpdateClient(
        [
            FakeUpdateContainer("plex", image="plex:latest"),
            FakeUpdateContainer("plex-helper", image="plex:latest"),
            FakeUpdateContainer("other", app_label="other"),
        ]
    )

    names = app_update.app_container_names(settings, client, "plex")

    assert names == ["plex", "plex-helper"]


def test_app_images_deduplicates(settings, write_registry):
    write_registry("plex", "containers", ["plex", "plex-helper"])
    client = FakeUpdateClient(
        [
            FakeUpdateContainer("plex", image="plex:latest"),
            FakeUpdateContainer("plex-helper", image="plex:latest"),
        ]
    )

    assert app_update.app_images(settings, client, "plex") == ["plex:latest"]


def test_update_app_pulls_and_recreates_each_container(settings, write_registry, monkeypatch):
    write_registry("plex", "containers", ["plex", "plex-helper"])
    client = FakeUpdateClient(
        [
            FakeUpdateContainer("plex", image="plex:latest"),
            FakeUpdateContainer("plex-helper", image="plex:latest"),
        ]
    )
    recreated: list[str] = []
    monkeypatch.setattr(
        app_update, "recreate_container", lambda client, container: recreated.append(container.name)
    )
    events: list[str] = []

    code, message = app_update.update_app(client, settings, "plex", events.append)

    assert (code, message) == (0, None)
    assert recreated == ["plex", "plex-helper"]
    assert client.images.pulled == ["plex:latest", "plex:latest"]
    assert any("Recréation de plex" in event for event in events)


def test_update_app_reports_missing_containers(settings):
    client = FakeUpdateClient([])

    code, message = app_update.update_app(client, settings, "ghost", lambda line: None)

    assert code == 1
    assert message is not None and "ghost" in message


def test_update_app_stops_on_pull_failure(settings, write_registry):
    write_registry("plex", "containers", ["plex"])
    client = FakeUpdateClient([FakeUpdateContainer("plex", image="plex:latest")])
    client.images.fail.add("plex:latest")

    code, message = app_update.update_app(client, settings, "plex", lambda line: None)

    assert code == 1
    assert message is not None and "plex:latest" in message


def test_build_mounts_ignores_binds_and_keeps_volumes():
    mounts = app_update._build_mounts(
        [
            {"Type": "bind", "Source": "/mnt", "Destination": "/mnt", "RW": True},
            {"Type": "volume", "Source": "vol", "Destination": "/data", "RW": False},
            {"Type": "volume", "Destination": "/anon", "RW": True},
        ]
    )

    assert mounts is not None
    assert len(mounts) == 1
    assert mounts[0]["Target"] == "/data"


@pytest.mark.parametrize("raw", [None, []])
def test_ulimits_handles_empty(raw):
    assert app_update._ulimits(raw) is None
