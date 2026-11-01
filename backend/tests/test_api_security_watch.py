import json

import docker

from app.deps import get_docker_client
from app.main import app
from app.services.security_watch import MAX_CONTAINERS, InventoryError, build_inventory


class Container:
    def __init__(self):
        self.name = "sonarr"
        self.reloaded = False
        self.attrs = {
            "Name": "/sonarr",
            "Image": "sha256:abc",
            "Config": {
                "Image": "lscr.io/linuxserver/sonarr:4.0.0",
                "Env": ["PASSWORD=very-secret", "API_KEY=hidden"],
                "Labels": {
                    "ssdv2.app": "sonarr",
                    "org.opencontainers.image.version": "4.0.0",
                    "private.token": "hidden",
                },
            },
            "HostConfig": {
                "Privileged": False,
                "PortBindings": {
                    "8989/tcp": [
                        {"HostIp": "0.0.0.0", "HostPort": "8989"},
                        {"HostIp": "127.0.0.1", "HostPort": "18989"},
                    ]
                },
                "Binds": ["/private/host/path:/config"],
            },
            "Mounts": [
                {"Source": "/home/private/.vault_pass", "Destination": "/config"},
                {"Source": "/var/run/docker.sock", "Destination": "/var/run/docker.sock"},
            ],
            "NetworkSettings": {"Networks": {"private-host-ip": {"IPAddress": "10.1.2.3"}}},
        }

    def reload(self):
        self.reloaded = True


class FakeClient:
    def __init__(self, containers):
        self.containers = self
        self.data = containers

    def list(self, all=False):
        assert all is True
        return self.data


def test_inventory_requires_authentication(client):
    response = client.get("/api/v1/security-watch/inventory")
    assert response.status_code == 401


def test_inventory_download_matches_security_watch_contract(auth_client):
    container = Container()
    app.dependency_overrides[get_docker_client] = lambda: FakeClient([container])
    response = auth_client.get("/api/v1/security-watch/inventory")

    assert response.status_code == 200
    assert container.reloaded
    assert response.headers["content-type"].startswith("application/json")
    assert "attachment;" in response.headers["content-disposition"]
    assert "no-store" in response.headers["cache-control"]
    data = response.json()
    assert data["schema_version"] == 1
    assert data["scope"] == "local_read_only"
    assert len(data["containers"]) == 1
    exported = data["containers"][0]
    assert exported["app"] == "sonarr"
    assert exported["image"] == "lscr.io/linuxserver/sonarr:4.0.0"
    assert exported["version"] == "4.0.0"
    assert exported["docker_socket"] is True
    assert exported["privileged"] is False
    assert {p["bind_type"] for p in exported["ports"]} == {"loopback", "all_interfaces"}
    assert "version_source" in exported

    raw = json.dumps(data)
    for sensitive in ("very-secret", "API_KEY", "hidden", "/private/host/path",
                      "/home/private", "10.1.2.3", "private.token", "Mounts", "NetworkSettings"):
        assert sensitive not in raw


def test_inventory_fails_closed_when_docker_unavailable(auth_client):
    app.dependency_overrides[get_docker_client] = lambda: None
    response = auth_client.get("/api/v1/security-watch/inventory")
    assert response.status_code == 503
    assert "Docker indisponible" in response.json()["detail"]


def test_inventory_error_does_not_leak_docker_exceptions(auth_client):
    class BrokenContainers:
        def list(self, all=False):
            raise docker.errors.DockerException("SECRET_HOST_PATH=/sensitive")

    class BrokenClient:
        containers = BrokenContainers()

    app.dependency_overrides[get_docker_client] = lambda: BrokenClient()
    response = auth_client.get("/api/v1/security-watch/inventory")
    assert response.status_code == 503
    assert "SECRET_HOST_PATH" not in response.text


def test_limit_fails_instead_of_exporting_partial_inventory():
    class TooManyClient:
        containers = FakeClient([Container()] * (MAX_CONTAINERS + 1))

    try:
        build_inventory(TooManyClient())
    except InventoryError as exc:
        assert "volumineux" in str(exc)
    else:
        raise AssertionError("un inventaire incomplet ne doit pas être exporté")
