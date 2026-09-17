import json
import os
import re
import subprocess
import threading
from collections.abc import Callable

from app.core.config import Settings

ALLOWED_COMMANDS = {
    ("apps", "list"),
    ("app", "status"),
    ("app", "install"),
    ("app", "remove"),
    ("app", "reinstall"),
    ("app", "recreate"),
    ("app", "start"),
    ("app", "stop"),
    ("app", "restart"),
    ("auth", "get"),
    ("auth", "set"),
    ("diagnostics", "run"),
}
ARGUMENT_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


class Ssdv2CtlError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _validate(args: list[str]) -> None:
    if len(args) < 2:
        raise Ssdv2CtlError("invalid_command", "commande ssdv2ctl invalide")
    if (args[0], args[1]) not in ALLOWED_COMMANDS:
        raise Ssdv2CtlError(
            "invalid_command", f"commande ssdv2ctl non autorisée: {' '.join(args[:2])}"
        )
    for argument in args[2:]:
        if argument.startswith("-") or ARGUMENT_PATTERN.match(argument):
            continue
        raise Ssdv2CtlError("invalid_argument", f"argument ssdv2ctl refusé: {argument}")


def _parse_error(stderr: str) -> tuple[str, str]:
    try:
        payload = json.loads(stderr)
        error = payload["error"]
        return str(error["code"]), str(error["message"])
    except (json.JSONDecodeError, KeyError, TypeError):
        lines = [line for line in stderr.splitlines() if line.strip()]
        return "ssdv2ctl_failed", lines[-1] if lines else "échec de ssdv2ctl"


class Ssdv2CtlRunner:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.path = settings.ssdv2ctl_path

    def _environment(self) -> dict[str, str]:
        environment = os.environ.copy()
        environment["SETTINGS_SOURCE"] = str(self.settings.ssdv2_source)
        environment["SETTINGS_STORAGE"] = str(self.settings.ssdv2_storage)
        return environment

    def run(self, args: list[str], timeout: int | None = None) -> dict:
        _validate(args)
        try:
            result = subprocess.run(
                [str(self.path), *args],
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,
                timeout=timeout or self.settings.ssdv2ctl_timeout,
                env=self._environment(),
                check=False,
            )
        except FileNotFoundError as exc:
            raise Ssdv2CtlError(
                "ssdv2ctl_unavailable", f"ssdv2ctl introuvable: {self.path}"
            ) from exc
        except OSError as exc:
            raise Ssdv2CtlError("ssdv2ctl_unavailable", str(exc)) from exc
        except subprocess.TimeoutExpired as exc:
            raise Ssdv2CtlError("ssdv2ctl_timeout", "ssdv2ctl a dépassé le délai") from exc

        if result.returncode != 0:
            code, message = _parse_error(result.stderr)
            raise Ssdv2CtlError(code, message)
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise Ssdv2CtlError("ssdv2ctl_invalid_output", "sortie ssdv2ctl non JSON") from exc
        if not isinstance(payload, dict):
            raise Ssdv2CtlError("ssdv2ctl_invalid_output", "sortie ssdv2ctl inattendue")
        return payload

    def run_streaming(
        self,
        args: list[str],
        on_line: Callable[[str], None],
        timeout: int | None = None,
    ) -> int:
        _validate(args)
        try:
            process = subprocess.Popen(
                [str(self.path), *args],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                stdin=subprocess.DEVNULL,
                env=self._environment(),
            )
        except OSError as exc:
            raise Ssdv2CtlError("ssdv2ctl_unavailable", str(exc)) from exc

        timed_out = False

        def _kill() -> None:
            nonlocal timed_out
            timed_out = True
            process.kill()

        timer = None
        if timeout:
            timer = threading.Timer(timeout, _kill)
            timer.start()
        try:
            assert process.stdout is not None
            for line in process.stdout:
                on_line(line.rstrip("\n"))
            process.wait()
        finally:
            if timer is not None:
                timer.cancel()
            if process.stdout is not None:
                process.stdout.close()

        if timed_out:
            raise Ssdv2CtlError("ssdv2ctl_timeout", "ssdv2ctl a dépassé le délai")
        return process.returncode if process.returncode is not None else -1

    def version(self) -> str | None:
        try:
            result = subprocess.run(
                [str(self.path), "--version"],
                capture_output=True,
                text=True,
                stdin=subprocess.DEVNULL,
                timeout=10,
                env=self._environment(),
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        if result.returncode != 0 or not result.stdout.strip():
            return None
        return result.stdout.strip()
