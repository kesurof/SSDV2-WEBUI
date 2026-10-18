from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import User, WebuiSetting

AUTH_MODE_KEY = "auth_mode"
LEGACY_INTERNAL_AUTH_KEY = "internal_auth"
AUTH_MODES = ("internal", "proxy")
SETUP_COMPLETED_KEY = "setup_completed"
INSTANCE_NAME_KEY = "instance_name"
NOTIFY_JOB_SUCCESS_KEY = "notify_job_success"

DEFAULT_INSTANCE_NAME = "SSDV2 WebUI"


def get_setting(db: Session, key: str) -> str | None:
    setting = db.get(WebuiSetting, key)
    return setting.value if setting is not None else None


def set_setting(db: Session, key: str, value: str) -> None:
    _set_setting(db, key, value)
    db.commit()


def _set_setting(db: Session, key: str, value: str) -> None:
    setting = db.get(WebuiSetting, key)
    if setting is None:
        db.add(WebuiSetting(key=key, value=value))
    else:
        setting.value = value


def stored_auth_mode(db: Session) -> str:
    """Mode enregistré (sans surcharge d'environnement), avec compatibilité legacy."""
    value = get_setting(db, AUTH_MODE_KEY)
    if value in AUTH_MODES:
        return value
    # Les modes désactivant toute authentification ne sont pas acceptés.
    if get_setting(db, LEGACY_INTERNAL_AUTH_KEY) == "false":
        return "proxy"
    return "internal"


def effective_auth_mode(db: Session) -> tuple[str, str]:
    """Renvoie (mode, source) ; source = 'env' si imposé par WEBUI_AUTH_MODE."""
    env_mode = get_settings().auth_mode
    if env_mode:
        # Une valeur d'environnement invalide ne peut pas ouvrir l'accès : elle impose
        # au contraire la connexion interne, sans contournement.
        return (env_mode if env_mode in AUTH_MODES else "internal"), "env"
    return stored_auth_mode(db), "settings"


def auth_mode(db: Session) -> str:
    return effective_auth_mode(db)[0]


def set_auth_mode(db: Session, mode: str) -> None:
    if mode not in AUTH_MODES:
        raise ValueError(f"mode d'authentification invalide: {mode}")
    _set_setting(db, AUTH_MODE_KEY, mode)
    db.commit()


def migrate_legacy_auth_mode(db: Session) -> str | None:
    """Persiste auth_mode depuis l'ancien booléen internal_auth. Renvoie le mode migré
    (ou None si déjà migré). false -> proxy (fail-closed), true/absent -> internal."""
    if get_setting(db, AUTH_MODE_KEY) is not None:
        return None
    mode = "proxy" if get_setting(db, LEGACY_INTERNAL_AUTH_KEY) == "false" else "internal"
    _set_setting(db, AUTH_MODE_KEY, mode)
    db.commit()
    return mode


def internal_auth_enabled(db: Session) -> bool:
    """Compatibilité : l'authentification interne est active quand le mode est internal."""
    return auth_mode(db) == "internal"


def set_internal_auth(db: Session, enabled: bool) -> None:
    """Compatibilité : bascule le mode internal/proxy depuis un booléen."""
    set_auth_mode(db, "internal" if enabled else "proxy")


def setup_required(db: Session) -> bool:
    if get_setting(db, SETUP_COMPLETED_KEY) == "true":
        return False
    user_count = db.scalar(select(func.count()).select_from(User))
    return not user_count


def mark_setup_completed(db: Session) -> None:
    set_setting(db, SETUP_COMPLETED_KEY, "true")


def get_instance_name(db: Session) -> str:
    return get_setting(db, INSTANCE_NAME_KEY) or DEFAULT_INSTANCE_NAME


def set_instance_name(db: Session, name: str) -> None:
    set_setting(db, INSTANCE_NAME_KEY, name)


def notify_job_success_enabled(db: Session) -> bool:
    return get_setting(db, NOTIFY_JOB_SUCCESS_KEY) != "false"


def set_notify_job_success(db: Session, enabled: bool) -> None:
    set_setting(db, NOTIFY_JOB_SUCCESS_KEY, "true" if enabled else "false")


def complete_initial_setup(
    db: Session,
    *,
    auth_mode: str,
    instance_name: str,
    notify_job_success: bool,
) -> None:
    """Enregistre tous les réglages initiaux dans la transaction appelante."""
    _set_setting(db, AUTH_MODE_KEY, auth_mode if auth_mode in AUTH_MODES else "internal")
    _set_setting(db, INSTANCE_NAME_KEY, instance_name)
    _set_setting(db, NOTIFY_JOB_SUCCESS_KEY, "true" if notify_job_success else "false")
    _set_setting(db, SETUP_COMPLETED_KEY, "true")
