import json
from pathlib import Path

from app.main import app


def main() -> None:
    output = Path(__file__).resolve().parent.parent / "openapi.json"
    output.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"OpenAPI écrit dans {output}")


if __name__ == "__main__":
    main()
