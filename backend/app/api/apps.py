from fastapi import APIRouter

from app.deps import CurrentUser, DockerDep, SettingsDep
from app.schemas.app import AppStateOut
from app.services.app_state import build_app_states
from app.services.catalogue import read_catalogue
from app.services.docker_state import collect_containers
from app.services.registries import read_registries
from app.services.ssddb import read_ssddb

router = APIRouter(prefix="/apps", tags=["apps"])


@router.get("", response_model=list[AppStateOut])
def list_apps(
    settings: SettingsDep,
    docker_client: DockerDep,
    _user: CurrentUser,
) -> list[AppStateOut]:
    entries, _error = read_catalogue(settings.catalogue_file)
    ssddb = read_ssddb(settings.ssddb_file)
    registries = read_registries(settings.registries_dir)
    snapshot = collect_containers(docker_client)
    return build_app_states(entries, ssddb, registries, snapshot)
