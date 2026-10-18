from __future__ import annotations

from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

# Les flux SSE : le gzip tamponnerait la sortie et casserait le direct. L'exclusion est
# faite par chemin, indépendamment du content-type et de la version de Starlette.
SSE_SUFFIXES = ("/events", "/logs/stream")


class ApiGZipMiddleware:
    """Compresse les réponses HTTP (dont les assets), sauf les flux SSE."""

    def __init__(self, app: ASGIApp, minimum_size: int = 500, compresslevel: int = 9) -> None:
        self.app = app
        self._gzip = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self._should_compress(scope["path"]):
            await self._gzip(scope, receive, send)
            return
        await self.app(scope, receive, send)

    @staticmethod
    def _should_compress(path: str) -> bool:
        return not path.endswith(SSE_SUFFIXES)
