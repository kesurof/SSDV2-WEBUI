from app.services import docker_state
from app.services.docker_state import clear_docker_cache, collect_containers


class CountingContainers:
    def __init__(self) -> None:
        self.calls = 0

    def list(self, all: bool = False) -> list:
        self.calls += 1
        return []


class CountingClient:
    def __init__(self) -> None:
        self.containers = CountingContainers()


def test_collect_containers_cached_within_ttl() -> None:
    clear_docker_cache()
    client = CountingClient()

    collect_containers(client)
    collect_containers(client)

    assert client.containers.calls == 1


def test_collect_containers_recomputes_after_ttl(monkeypatch) -> None:
    clear_docker_cache()
    monkeypatch.setattr(docker_state, "CACHE_TTL_SECONDS", 0.0)
    client = CountingClient()

    collect_containers(client)
    collect_containers(client)

    assert client.containers.calls == 2


def test_clear_docker_cache_forces_recompute() -> None:
    clear_docker_cache()
    client = CountingClient()

    collect_containers(client)
    clear_docker_cache()
    collect_containers(client)

    assert client.containers.calls == 2


def test_collect_containers_without_docker_is_cached() -> None:
    clear_docker_cache()

    first = collect_containers(None)
    second = collect_containers(None)

    assert first is second
    assert first.error == "Docker indisponible"
