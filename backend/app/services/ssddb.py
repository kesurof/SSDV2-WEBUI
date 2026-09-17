import sqlite3
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SsddbApplication:
    name: str
    status: int | None
    subdomain: str | None
    port: int | None


@dataclass(frozen=True)
class SsddbData:
    applications: dict[str, SsddbApplication]
    domain: str | None
    warnings: list[str]


def read_ssddb(path: Path) -> SsddbData:
    if not path.is_file():
        return SsddbData({}, None, [f"ssddb introuvable: {path}"])
    try:
        with sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True) as conn:
            conn.row_factory = sqlite3.Row
            applications = {
                row["name"]: SsddbApplication(
                    name=row["name"],
                    status=row["status"],
                    subdomain=row["subdomain"],
                    port=row["port"],
                )
                for row in conn.execute("select name, status, subdomain, port from applications")
            }
            domain_row = conn.execute(
                "select value from seedbox_params where param = 'domain'"
            ).fetchone()
            domain = domain_row["value"] if domain_row else None
            return SsddbData(applications, domain, [])
    except sqlite3.Error as exc:
        return SsddbData({}, None, [f"ssddb illisible: {exc}"])
