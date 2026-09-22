from pathlib import Path
from types import SimpleNamespace

import docker

from app.services import self_update
from app.services.jobs import job_manager


class FakeContainer:
    def __init__(self, name: str, attrs: dict | None = None) -> None:
        self.name = name
        self.attrs = attrs or {}


class FakeContainers:
    def __init__(self, mapping: dict) -> None:
        self.mapping = mapping
        self.run_calls: list[tuple] = []

    def get(self, reference: str):
        if reference in self.mapping:
            return self.mapping[reference]
        raise docker.errors.NotFound(reference)

    def run(self, *args, **kwargs):
        self.run_calls.append((args, kwargs))
        return object()


class FakeClient:
    def __init__(self, mapping: dict) -> None:
        self.containers = FakeContainers(mapping)


def _attrs() -> dict:
    return {
        "Config": {
            "Image": "ghcr.io/kesurof/ssdv2-webui:latest",
            "Env": ["HOME=/home/kesurof", "PUID=1000", "SSDV2_NON_INTERACTIVE=0"],
        },
        "HostConfig": {
            "Binds": ["/var/run/docker.sock:/var/run/docker.sock:rw"],
            "NetworkMode": "traefik_proxy",
        },
    }


def test_is_self_update(monkeypatch):
    monkeypatch.setattr(self_update.socket, "gethostname", lambda: "abc123")
    client = FakeClient({"abc123": FakeContainer("ssdv2webui")})

    assert self_update.is_self_update(client, "ssdv2webui") is True
    assert self_update.is_self_update(client, "plex") is False


def test_launch_updater_uses_current_container_config(monkeypatch):
    monkeypatch.setattr(self_update.socket, "gethostname", lambda: "abc123")
    client = FakeClient({"abc123": FakeContainer("ssdv2webui", _attrs())})
    settings = SimpleNamespace(ssdv2_source=Path("/src"), ssdv2_storage=Path("/storage"))

    name = self_update.launch_updater(client, settings, "ssdv2webui", ["bash", "-lc", "true"])

    assert name == "ssdv2webui-updater"
    assert len(client.containers.run_calls) == 1
    _, kwargs = client.containers.run_calls[0]
    assert kwargs["network_mode"] == "traefik_proxy"
    assert kwargs["volumes"] == ["/var/run/docker.sock:/var/run/docker.sock:rw"]
    assert "SETTINGS_SOURCE=/src" in kwargs["environment"]
    assert "SSDV2_NON_INTERACTIVE=1" in kwargs["environment"]
    assert "SSDV2_NON_INTERACTIVE=0" not in kwargs["environment"]


def test_steps_script_recreate() -> None:
    runner = SimpleNamespace(
        settings=SimpleNamespace(ssdv2_storage=Path("/storage")),
        dispatcher=Path("/src/generique.sh"),
    )
    script = job_manager._steps_script(
        runner, "ssdv2webui", [("bash", "relance_container", ["ssdv2webui"])]
    )
    assert script == "set -e; bash /src/generique.sh relance_container ssdv2webui"


def test_steps_script_reinstall() -> None:
    runner = SimpleNamespace(
        settings=SimpleNamespace(ssdv2_storage=Path("/storage")),
        dispatcher=Path("/src/generique.sh"),
    )
    steps = [
        ("bash", "suppression_appli", ["ssdv2webui", "0"]),
        ("remove", "ssdv2webui"),
        ("bash", "launch_service", ["ssdv2webui"]),
    ]
    script = job_manager._steps_script(runner, "ssdv2webui", steps)
    assert "rm -f /storage/conf/ssdv2webui.yml /storage/vars/ssdv2webui.yml" in script
    assert "bash /src/generique.sh suppression_appli ssdv2webui 0" in script
    assert "bash /src/generique.sh launch_service ssdv2webui" in script
