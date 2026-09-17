from datetime import datetime

from pydantic import BaseModel


class BackupOut(BaseModel):
    app: str
    file: str
    size: int
    created_at: datetime
