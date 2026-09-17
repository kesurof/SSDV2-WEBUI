from sqlalchemy.orm import Session

from app.db.models import WebuiSetting

INTERNAL_AUTH_KEY = "internal_auth"


def get_setting(db: Session, key: str) -> str | None:
    setting = db.get(WebuiSetting, key)
    return setting.value if setting is not None else None


def set_setting(db: Session, key: str, value: str) -> None:
    setting = db.get(WebuiSetting, key)
    if setting is None:
        db.add(WebuiSetting(key=key, value=value))
    else:
        setting.value = value
    db.commit()


def internal_auth_enabled(db: Session) -> bool:
    return get_setting(db, INTERNAL_AUTH_KEY) != "false"


def set_internal_auth(db: Session, enabled: bool) -> None:
    set_setting(db, INTERNAL_AUTH_KEY, "true" if enabled else "false")
