import textwrap
from pathlib import Path

import pytest

from app.adapters.ssdv2_cli import Ssdv2CtlError, Ssdv2CtlRunner
from app.core.config import Settings

OK_SCRIPT = """\
#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "ssdv2ctl 9.9.9"
  exit 0
fi
echo '{
  "schema": 1,
  "checks": {"missing_registries": [], "orphan_containers": [], "dangling_volumes": 0},
  "warnings": []
}'
"""

ERROR_SCRIPT = """\
#!/bin/sh
echo '{"error": {"code": "no_containers", "message": "aucun conteneur"}}' >&2
exit 1
"""

PLAIN_ERROR_SCRIPT = """\
#!/bin/sh
echo "boom" >&2
exit 1
"""

INVALID_OUTPUT_SCRIPT = """\
#!/bin/sh
echo "pas du json"
"""


def write_script(tmp_path: Path, content: str, name: str = "ssdv2ctl") -> Path:
    path = tmp_path / name
    path.write_text(textwrap.dedent(content), encoding="utf-8")
    path.chmod(0o755)
    return path


def make_runner(tmp_path: Path, script: Path) -> Ssdv2CtlRunner:
    settings = Settings(
        ssdv2_source=tmp_path,
        ssdv2_storage=tmp_path,
        ssdv2ctl_path=script,
        webui_data=tmp_path,
    )
    return Ssdv2CtlRunner(settings)


def test_run_returns_payload(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, OK_SCRIPT))

    payload = runner.run(["diagnostics", "run"])

    assert payload["schema"] == 1
    assert payload["checks"]["dangling_volumes"] == 0


def test_run_rejects_disallowed_command(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, OK_SCRIPT))

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["shell", "run"])

    assert error.value.code == "invalid_command"


def test_run_rejects_invalid_argument(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, OK_SCRIPT))

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["app", "status", "sonarr; rm -rf /"])

    assert error.value.code == "invalid_argument"


def test_run_reports_structured_error(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, ERROR_SCRIPT))

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["app", "start", "sonarr"])

    assert error.value.code == "no_containers"
    assert error.value.message == "aucun conteneur"


def test_run_reports_plain_error(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, PLAIN_ERROR_SCRIPT))

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["app", "start", "sonarr"])

    assert error.value.code == "ssdv2ctl_failed"


def test_run_reports_invalid_output(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, INVALID_OUTPUT_SCRIPT))

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["diagnostics", "run"])

    assert error.value.code == "ssdv2ctl_invalid_output"


def test_run_missing_binary(tmp_path):
    runner = make_runner(tmp_path, tmp_path / "absent")

    with pytest.raises(Ssdv2CtlError) as error:
        runner.run(["diagnostics", "run"])

    assert error.value.code == "ssdv2ctl_unavailable"


def test_version(tmp_path):
    runner = make_runner(tmp_path, write_script(tmp_path, OK_SCRIPT))
    assert runner.version() == "ssdv2ctl 9.9.9"

    missing = make_runner(tmp_path, tmp_path / "absent")
    assert missing.version() is None
