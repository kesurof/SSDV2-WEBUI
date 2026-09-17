from fastapi import APIRouter, HTTPException, status

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import CurrentUser, Ssdv2CtlDep
from app.schemas.config import ConfigOut

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=ConfigOut)
def get_config(runner: Ssdv2CtlDep, _user: CurrentUser) -> ConfigOut:
    try:
        payload = runner.run(["config", "list"])
    except Ssdv2CtlError as exc:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code == "ssdv2ctl_unavailable"
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(code, exc.message) from exc
    return ConfigOut.model_validate(payload)
