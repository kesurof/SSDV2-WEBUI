import time

from app.adapters.ssdv2_cli import Ssdv2CtlError, Ssdv2CtlRunner

CACHE_TTL_SECONDS = 300

_cache_value: str | None = None
_cache_at: float = 0.0
_cache_valid: bool = False


def clear_domain_cache() -> None:
    global _cache_value, _cache_at, _cache_valid
    _cache_value = None
    _cache_at = 0.0
    _cache_valid = False


def get_global_domain(runner: Ssdv2CtlRunner, ssddb_domain: str | None = None) -> str | None:
    global _cache_value, _cache_at, _cache_valid

    now = time.monotonic()
    if _cache_valid and now - _cache_at < CACHE_TTL_SECONDS:
        return _cache_value or ssddb_domain

    try:
        payload = runner.run(["config", "get", "user.domain"])
        raw = payload.get("value")
        value = raw.strip() if isinstance(raw, str) and raw.strip() else None
    except Ssdv2CtlError:
        value = None

    _cache_value = value
    _cache_at = now
    _cache_valid = True
    return value or ssddb_domain
