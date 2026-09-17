import logging
import secrets
from pathlib import Path

TOKEN_FILENAME = "setup-token"

logger = logging.getLogger(__name__)


def token_path(data_dir: Path) -> Path:
    return data_dir / TOKEN_FILENAME


def read_setup_token(data_dir: Path) -> str | None:
    path = token_path(data_dir)
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8").strip()


def ensure_setup_token(data_dir: Path) -> str:
    existing = read_setup_token(data_dir)
    if existing:
        return existing
    token = secrets.token_urlsafe(16)
    data_dir.mkdir(parents=True, exist_ok=True)
    path = token_path(data_dir)
    path.write_text(f"{token}\n", encoding="utf-8")
    path.chmod(0o600)
    logger.warning(
        "Assistant de premier démarrage disponible — jeton d'installation : %s (fichier %s)",
        token,
        path,
    )
    return token


def clear_setup_token(data_dir: Path) -> None:
    token_path(data_dir).unlink(missing_ok=True)
