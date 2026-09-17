import logging
from collections.abc import Mapping
from typing import Any

REDACTED = "***"
_SENSITIVE_PARTS = ("password", "token", "secret", "authorization", "cookie", "vault", "api_key")


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def redact(data: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: REDACTED if any(part in key.lower() for part in _SENSITIVE_PARTS) else value
        for key, value in data.items()
    }
