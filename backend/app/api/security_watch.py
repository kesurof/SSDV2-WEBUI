"""Téléchargement authentifié d'un diagnostic portable pour SSDv2 Security Watch."""
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.deps import CurrentUser, DockerDep
from app.services.security_watch import InventoryError, build_inventory

router = APIRouter(prefix="/security-watch", tags=["security-watch"])


@router.get("/inventory", response_class=Response)
def download_inventory(docker_client: DockerDep, _user: CurrentUser) -> Response:
    try:
        inventory = build_inventory(docker_client)
    except InventoryError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(
        content=json.dumps(inventory, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="ssdv2-security-inventory.json"',
            "Cache-Control": "no-store, private, max-age=0",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
    )
