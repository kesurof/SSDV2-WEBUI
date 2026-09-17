from app.services.app_state import (
    WARNING_CONTAINERS_WITHOUT_SSDDB,
    WARNING_DOCKER_UNAVAILABLE,
    WARNING_INSTALLED_WITHOUT_CONTAINERS,
    WARNING_MISSING_REGISTRY,
    WARNING_UNHEALTHY,
    build_app_states,
)
from app.services.catalogue import CatalogueEntry
from app.services.docker_state import ContainerInfo, DockerSnapshot
from app.services.registries import Registry
from app.services.ssddb import SsddbApplication, SsddbData

ENTRY = CatalogueEntry(name="sonarr", description="Gestion Séries")


def _ssddb(*names: str, domain: str | None = "example.com") -> SsddbData:
    applications = {
        name: SsddbApplication(name=name, status=2, subdomain=name, port=8000) for name in names
    }
    return SsddbData(applications=applications, domain=domain, warnings=[])


def _container(name: str, state: str = "running", health: str | None = None, app_label=None):
    return ContainerInfo(name=name, image="img:1", state=state, health=health, app_label=app_label)


def test_running_app_matched_by_label():
    states = build_app_states(
        [ENTRY],
        _ssddb("sonarr"),
        {"sonarr": Registry(containers=["sonarr"])},
        DockerSnapshot([_container("sonarr", health="healthy", app_label="sonarr")], None),
    )
    app = states[0]
    assert app.installed is True
    assert app.runtime_status == "running"
    assert app.healthy is True
    assert app.url == "https://sonarr.example.com"
    assert app.warnings == []


def test_registry_match_without_label():
    states = build_app_states(
        [ENTRY],
        SsddbData({}, None, []),
        {"sonarr": Registry(containers=["sonarr-db"])},
        DockerSnapshot([_container("sonarr-db")], None),
    )
    app = states[0]
    assert app.installed is True
    assert app.containers == 1
    assert WARNING_CONTAINERS_WITHOUT_SSDDB in app.warnings


def test_installed_without_containers():
    states = build_app_states([ENTRY], _ssddb("sonarr"), {}, DockerSnapshot([], None))
    app = states[0]
    assert app.installed is True
    assert app.runtime_status == "unknown"
    assert WARNING_INSTALLED_WITHOUT_CONTAINERS in app.warnings
    assert WARNING_MISSING_REGISTRY in app.warnings


def test_partial_and_unhealthy():
    states = build_app_states(
        [ENTRY],
        _ssddb("sonarr"),
        {"sonarr": Registry(containers=["sonarr", "sonarr-db"])},
        DockerSnapshot(
            [
                _container("sonarr", health="unhealthy"),
                _container("sonarr-db", state="exited"),
            ],
            None,
        ),
    )
    app = states[0]
    assert app.runtime_status == "partial"
    assert app.healthy is False
    assert WARNING_UNHEALTHY in app.warnings


def test_docker_unavailable():
    states = build_app_states(
        [ENTRY], _ssddb("sonarr"), {}, DockerSnapshot([], "Docker indisponible")
    )
    assert WARNING_DOCKER_UNAVAILABLE in states[0].warnings


def test_not_installed_app():
    states = build_app_states([ENTRY], SsddbData({}, None, []), {}, DockerSnapshot([], None))
    app = states[0]
    assert app.installed is False
    assert app.runtime_status == "not_installed"
    assert app.url is None
    assert app.image is None
