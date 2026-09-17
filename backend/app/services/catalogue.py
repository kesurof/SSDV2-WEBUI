import re
from dataclasses import dataclass
from pathlib import Path

SEPARATOR = " - "
_NO_SPACE_SEPARATOR = re.compile(r"^(?P<name>\S+?)\s*-\s+(?P<description>.*)$")


@dataclass(frozen=True)
class CatalogueEntry:
    name: str
    description: str


def parse_catalogue(text: str) -> list[CatalogueEntry]:
    entries: list[CatalogueEntry] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if SEPARATOR in line:
            name, description = line.split(SEPARATOR, 1)
        else:
            match = _NO_SPACE_SEPARATOR.match(line)
            if match:
                name, description = match.group("name"), match.group("description")
            else:
                name, description = line, ""
        name = name.strip()
        if not name:
            continue
        entries.append(CatalogueEntry(name=name, description=description.strip()))
    return sorted(entries, key=lambda entry: entry.name.lower())


def read_catalogue(path: Path) -> tuple[list[CatalogueEntry], str | None]:
    if not path.is_file():
        return [], f"catalogue introuvable: {path}"
    return parse_catalogue(path.read_text(encoding="utf-8")), None
