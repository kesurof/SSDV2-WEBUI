from app.schemas.app import AppDetailOut, AppStateOut, ContainerOut, RegistriesOut, SsddbAppOut
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


def _build_fqdn(subdomain: str | None, domain: str | None) -> str | None:
    if not subdomain:
        return None
    if "." in subdomain:
        return subdomain
    if domain:
        return f"{subdomain}.{domain}"
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


def build_app_state(
    entry: CatalogueEntry,
    app_ssddb,
    registry: Registry | None,
    containers: list[ContainerInfo],
    docker_error: str | None,
    domain: str | None = None,
) -> AppStateOut:
    installed = app_ssddb is not None or registry is not None or bool(containers)

    warnings: list[str] = []
    if docker_error:
        warnings.append(WARNING_DOCKER_UNAVAILABLE)
    if app_ssddb is not None and not containers:
        warnings.append(WARNING_INSTALLED_WITHOUT_CONTAINERS)
    if app_ssddb is not None and registry is None:
        warnings.append(WARNING_MISSING_REGISTRY)
    if containers and app_ssddb is None:
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

    fqdn = _build_fqdn(app_ssddb.subdomain if app_ssddb else None, domain)
    return AppStateOut(
        name=entry.name,
        description=entry.description,
        available=True,
        installed=installed,
        runtime_status=runtime_status,
        healthy=healthy,
        url=f"https://{fqdn}" if fqdn else None,
        domain=fqdn,
        image=containers[0].image if containers else None,
        containers=len(containers),
        warnings=warnings,
    )


def build_app_states(
    entries: list[CatalogueEntry],
    ssddb: SsddbData,
    registries: dict[str, Registry],
    snapshot: DockerSnapshot,
    domain: str | None = None,
) -> list[AppStateOut]:
    effective_domain = domain if domain is not None else ssddb.domain
    states = []
    for entry in entries:
        registry = registries.get(entry.name)
        containers = _matching_containers(entry.name, registry, snapshot.containers)
        states.append(
            build_app_state(
                entry,
                ssddb.applications.get(entry.name),
                registry,
                containers,
                snapshot.error,
                effective_domain,
            )
        )
    return states


def build_app_detail(
    entry: CatalogueEntry,
    ssddb: SsddbData,
    registry: Registry | None,
    snapshot: DockerSnapshot,
    domain: str | None = None,
) -> AppDetailOut:
    containers = _matching_containers(entry.name, registry, snapshot.containers)
    app_ssddb = ssddb.applications.get(entry.name)
    effective_domain = domain if domain is not None else ssddb.domain
    state = build_app_state(
        entry, app_ssddb, registry, containers, snapshot.error, effective_domain
    )
    return AppDetailOut(
        **state.model_dump(),
        container_list=[
            ContainerOut(
                name=container.name,
                image=container.image or None,
                state=container.state,
                health=container.health,
                started_at=container.started_at,
                created_at=container.created_at,
                image_id=container.image_id,
            )
            for container in sorted(containers, key=lambda item: item.name)
        ],
        ssddb=(
            SsddbAppOut(
                status=app_ssddb.status,
                subdomain=app_ssddb.subdomain,
                port=app_ssddb.port,
            )
            if app_ssddb
            else None
        ),
        registries=RegistriesOut(
            containers=registry.containers if registry else [],
            volumes=registry.volumes if registry else [],
            dns=registry.dns if registry else [],
        ),
    )
