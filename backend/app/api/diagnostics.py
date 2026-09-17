from fastapi import APIRouter, HTTPException, status

from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.deps import CurrentUser, Ssdv2CtlDep
from app.schemas.diagnostics import DiagnosticsOut

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("", response_model=DiagnosticsOut)
def run_diagnostics(runner: Ssdv2CtlDep, _user: CurrentUser) -> DiagnosticsOut:
    try:
        payload = runner.run(["diagnostics", "run"])
    except Ssdv2CtlError as exc:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code == "ssdv2ctl_unavailable"
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(code, exc.message) from exc
    return DiagnosticsOut.model_validate(payload)
