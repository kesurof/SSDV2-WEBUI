from fastapi import APIRouter

from app.deps import CurrentUser, SettingsDep
from app.schemas.backup import BackupOut
from app.services.backups import list_backups

router = APIRouter(prefix="/backups", tags=["backups"])


@router.get("", response_model=list[BackupOut])
def get_backups(settings: SettingsDep, _user: CurrentUser) -> list[BackupOut]:
    return [
        BackupOut(app=item.app, file=item.file, size=item.size, created_at=item.created_at)
        for item in list_backups(settings.backup_dir)
    ]
