from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import User, WebuiSetting

INTERNAL_AUTH_KEY = "internal_auth"
SETUP_COMPLETED_KEY = "setup_completed"
INSTANCE_NAME_KEY = "instance_name"
NOTIFY_JOB_SUCCESS_KEY = "notify_job_success"

DEFAULT_INSTANCE_NAME = "SSDV2 WebUI"


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
