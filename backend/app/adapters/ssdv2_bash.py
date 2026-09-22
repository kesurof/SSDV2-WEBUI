import codecs
import fcntl
import os
import pty
import re
import select
import struct
import subprocess
import termios
import threading
import time
from collections.abc import Callable
from pathlib import Path

from app.adapters.ssdv2_cli import ARGUMENT_PATTERN, Ssdv2CtlError
from app.core.config import Settings

DISPATCHER_RELATIVE = Path("includes") / "config" / "scripts" / "generique.sh"

INTERACTIVE_FUNCTIONS = {
    "launch_service": 1,
    "relance_container": 1,
    "suppression_appli": 2,
    "manage_account_yml": 2,
}
READ_FUNCTIONS = {
    "get_from_account_yml": 1,
}

ACCOUNT_KEY_PATTERN = re.compile(
    r"^sub\.[a-z0-9][a-z0-9-]*\.([a-z0-9][a-z0-9-]{0,61}[a-z0-9]|auth)$"
)
READ_KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,80}$")

POLL_INTERVAL = 0.2
READ_CHUNK_SIZE = 65536
BANNER_PREFIXES = ("TASK [", "PLAY ", "PLAY RECAP", "RUNNING HANDLER [", "[")


def _is_banner(line: str) -> bool:
    return line.strip().startswith(BANNER_PREFIXES)


class PromptTimeout(Exception):
    def __init__(self, kind: str) -> None:
        super().__init__(kind)
        self.kind = kind


def _validate_key(function: str, args: list[str], app: str | None) -> None:
    if function == "manage_account_yml":
        key, value = args
        if not ACCOUNT_KEY_PATTERN.match(key):
            raise Ssdv2CtlError("invalid_argument", f"clé account.yml refusée: {key}")
        if app is not None and not key.startswith(f"sub.{app}."):
            raise Ssdv2CtlError("invalid_argument", f"clé hors de l'application {app}: {key}")
        if not value or len(value) > 120 or not ARGUMENT_PATTERN.match(value):
            raise Ssdv2CtlError("invalid_argument", f"valeur account.yml refusée: {value!r}")
    if function == "get_from_account_yml":
        (key,) = args
        if not READ_KEY_PATTERN.match(key):
            raise Ssdv2CtlError("invalid_argument", f"clé account.yml refusée: {key}")
    if function == "suppression_appli":
        _, delete_data = args
        if delete_data not in ("0", "1"):
            raise Ssdv2CtlError("invalid_argument", f"mode de suppression refusé: {delete_data}")


def _usable_venv_bin(settings: Settings) -> Path | None:
    venv_bin = settings.ssdv2_source / "venv" / "bin"
    candidate = venv_bin / "ansible-playbook"
    if not candidate.is_file():
        return None
    try:
        result = subprocess.run(
            [str(candidate), "--version"],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return venv_bin if result.returncode == 0 else None


def _bash_environment(settings: Settings) -> dict[str, str]:
    environment = os.environ.copy()
    environment["SETTINGS_SOURCE"] = str(settings.ssdv2_source)
    environment["SETTINGS_STORAGE"] = str(settings.ssdv2_storage)
    if not environment.get("USER"):
        home = environment.get("HOME", str(Path.home()))
        environment["USER"] = Path(home).name
    venv_bin = _usable_venv_bin(settings)
    if venv_bin is not None:
        environment["PATH"] = f"{venv_bin}{os.pathsep}{environment.get('PATH', '')}"
    return environment


def _open_pty() -> tuple[int, int]:
    master, slave = pty.openpty()
    attrs = termios.tcgetattr(slave)
    attrs[3] &= ~termios.ECHO
    termios.tcsetattr(slave, termios.TCSANOW, attrs)
    try:
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 200, 0, 0))
    except OSError:
        pass
    return master, slave


class InteractiveProcess:
    def __init__(self, argv: list[str], environment: dict[str, str]) -> None:
        master, slave = _open_pty()
        self._master = master
        self._closed = False
        try:
            self._process = subprocess.Popen(
                argv,
                stdin=slave,
                stdout=slave,
                stderr=slave,
                bufsize=0,
                env=environment,
                start_new_session=True,
                close_fds=True,
            )
        finally:
            os.close(slave)
        self._lock = threading.Lock()
        self._prompt_pending = False
        self._killed = False
        self._last_emitted: str | None = None

    def write(self, value: str) -> None:
        with self._lock:
            self._prompt_pending = False
        try:
            os.write(self._master, (value + "\n").encode("utf-8"))
        except OSError:
            pass

    def kill(self) -> None:
        self._killed = True
        try:
            self._process.kill()
        except OSError:
            pass
        self._close_master()

    def _close_master(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            os.close(self._master)
        except OSError:
            pass

    @property
    def killed(self) -> bool:
        return self._killed

    def prompt_pending(self) -> bool:
        with self._lock:
            return self._prompt_pending

    def _mark_prompt(self) -> None:
        with self._lock:
            self._prompt_pending = True

    def run(
        self,
        on_line: Callable[[str], None],
        on_prompt: Callable[[object, str], None],
        detect_prompt: Callable[[str], object | None],
        timeout: float,
        idle_timeout: float,
    ) -> int:
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        buffer = ""
        last_activity = time.monotonic()
        deadline = last_activity + timeout

        def maybe_emit(text: str) -> None:
            stripped = text.strip()
            if not stripped or stripped == self._last_emitted or self.prompt_pending():
                return
            spec = detect_prompt(text)
            if spec is None:
                return
            self._last_emitted = stripped
            self._mark_prompt()
            on_prompt(spec, text)

        try:
            while True:
                if time.monotonic() > deadline:
                    self.kill()
                    raise PromptTimeout("global")
                try:
                    readable, _, _ = select.select([self._master], [], [], POLL_INTERVAL)
                except (OSError, ValueError):
                    break
                if readable:
                    try:
                        chunk = os.read(self._master, READ_CHUNK_SIZE)
                    except OSError:
                        break
                    if not chunk:
                        break
                    last_activity = time.monotonic()
                    buffer += decoder.decode(chunk)
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        on_line(line)
                        if not _is_banner(line):
                            maybe_emit(line)
                    maybe_emit(buffer)
                elif self.prompt_pending() and time.monotonic() - last_activity > idle_timeout:
                    self.kill()
                    raise PromptTimeout("idle")

            buffer += decoder.decode(b"", final=True)
            if buffer:
                on_line(buffer)
            return self._process.wait()
        finally:
            self._close_master()


class Ssdv2BashRunner:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.dispatcher = settings.ssdv2_source / DISPATCHER_RELATIVE

    def _validate(self, function: str, args: list[str], app: str | None) -> None:
        expected = INTERACTIVE_FUNCTIONS.get(function)
        if expected is None:
            raise Ssdv2CtlError("invalid_command", f"fonction SSDV2 refusée: {function}")
        if len(args) != expected:
            raise Ssdv2CtlError("invalid_argument", f"arité invalide pour {function}")
        if app is not None and not ARGUMENT_PATTERN.match(app):
            raise Ssdv2CtlError("invalid_argument", f"nom d'application refusé: {app}")
        _validate_key(function, args, app)

    def spawn(self, function: str, args: list[str], app: str | None = None) -> InteractiveProcess:
        self._validate(function, args, app)
        if not self.dispatcher.is_file():
            raise Ssdv2CtlError(
                "ssdv2_functions_unavailable", f"dispatcher SSDV2 introuvable: {self.dispatcher}"
            )
        argv = ["bash", str(self.dispatcher), function, *args]
        return InteractiveProcess(argv, _bash_environment(self.settings))

    def capture(self, function: str, args: list[str], timeout: int = 120) -> str:
        if function not in READ_FUNCTIONS:
            raise Ssdv2CtlError("invalid_command", f"fonction SSDV2 refusée: {function}")
        if len(args) != READ_FUNCTIONS[function]:
            raise Ssdv2CtlError("invalid_argument", f"arité invalide pour {function}")
        _validate_key(function, args, None)
        if not self.dispatcher.is_file():
            raise Ssdv2CtlError(
                "ssdv2_functions_unavailable", f"dispatcher SSDV2 introuvable: {self.dispatcher}"
            )
        result = subprocess.run(
            ["bash", str(self.dispatcher), function, *args],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=timeout,
            env=_bash_environment(self.settings),
            check=False,
        )
        if result.returncode != 0:
            raise Ssdv2CtlError("ssdv2ctl_failed", f"lecture {function} en échec")
        return result.stdout.strip()
