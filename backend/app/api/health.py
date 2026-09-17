from fastapi import APIRouter

from app.deps import SettingsDep
from app.schemas.auth import HealthOut
from app.services.health import build_health_status

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(settings: SettingsDep) -> HealthOut:
    return build_health_status(settings)
