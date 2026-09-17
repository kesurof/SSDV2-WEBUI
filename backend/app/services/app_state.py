from app.schemas.app import AppStateOut
from app.services.catalogue import CatalogueEntry
from app.services.docker_state import ContainerInfo, DockerSnapshot
from app.services.registries import Registry
from app.services.ssddb import SsddbData

WARNING_INSTALLED_WITHOUT_CONTAINERS = "installed_without_containers"
WARNING_MISSING_REGISTRY = "missing_registry"
WARNING_CONTAINERS_WITHOUT_SSDDB = "containers_without_ssddb"
WARNING_UNHEALTHY = "unhealthy"
WARNING_DOCKER_UNAVAILABLE = "docker_unavailable"
WARNING_CATALOGUE_UNAVAILABLE = "catalogue_unavailable"
WARNING_SSDDB_UNAVAILABLE = "ssddb_unavailable"


def _build_url(subdomain: str | None, domain: str | None) -> str | None:
    if not subdomain:
        return None
    if "." in subdomain:
        return f"https://{subdomain}"
    if domain:
        return f"https://{subdomain}.{domain}"
    return None


def _matching_containers(
    name: str, registry: Registry | None, containers: list[ContainerInfo]
) -> list[ContainerInfo]:
    return [
        container
        for container in containers
        if container.app_label == name
        or (registry is not None and container.name in registry.containers)
        or container.name == name
    ]


def build_app_states(
    entries: list[CatalogueEntry],
    ssddb: SsddbData,
    registries: dict[str, Registry],
    snapshot: DockerSnapshot,
) -> list[AppStateOut]:
    states: list[AppStateOut] = []
    for entry in entries:
        registry = registries.get(entry.name)
        containers = _matching_containers(entry.name, registry, snapshot.containers)
        ssddb_app = ssddb.applications.get(entry.name)
        installed = ssddb_app is not None or registry is not None or bool(containers)

        warnings: list[str] = []
        if snapshot.error:
            warnings.append(WARNING_DOCKER_UNAVAILABLE)
        if ssddb_app is not None and not containers:
            warnings.append(WARNING_INSTALLED_WITHOUT_CONTAINERS)
        if ssddb_app is not None and registry is None:
            warnings.append(WARNING_MISSING_REGISTRY)
        if containers and ssddb_app is None:
            warnings.append(WARNING_CONTAINERS_WITHOUT_SSDDB)

        healths = [container.health for container in containers if container.health]
        if any(health == "unhealthy" for health in healths):
            warnings.append(WARNING_UNHEALTHY)
        healthy = all(health == "healthy" for health in healths) if healths else None

        if not containers:
            runtime_status = "unknown" if installed else "not_installed"
        else:
            running = [container for container in containers if container.state == "running"]
            if len(running) == len(containers):
                runtime_status = "running"
            elif running:
                runtime_status = "partial"
            else:
                runtime_status = "stopped"

        states.append(
            AppStateOut(
                name=entry.name,
                description=entry.description,
                available=True,
                installed=installed,
                runtime_status=runtime_status,
                healthy=healthy,
                url=_build_url(ssddb_app.subdomain if ssddb_app else None, ssddb.domain),
                image=containers[0].image if containers else None,
                containers=len(containers),
                warnings=warnings,
            )
        )
    return states
