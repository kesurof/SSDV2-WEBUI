import os
import sys
import termios

import pytest

from app.adapters import ssdv2_bash
from app.adapters.ssdv2_bash import Ssdv2BashRunner, _open_pty
from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.services.prompts import detect


def test_usable_venv_bin_absent(settings, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ssdv2_source", tmp_path)
    assert ssdv2_bash._usable_venv_bin(settings) is None


def test_usable_venv_bin_broken(settings, tmp_path, monkeypatch):
    venv_bin = tmp_path / "venv" / "bin"
    venv_bin.mkdir(parents=True)
    (venv_bin / "ansible-playbook").write_text("#!/nonexistent/python\n", encoding="utf-8")
    monkeypatch.setattr(settings, "ssdv2_source", tmp_path)

    def _raise(*_args, **_kwargs):
        raise FileNotFoundError("interpréteur introuvable")

    monkeypatch.setattr(ssdv2_bash.subprocess, "run", _raise)
    assert ssdv2_bash._usable_venv_bin(settings) is None


def test_usable_venv_bin_ok(settings, tmp_path, monkeypatch):
    venv_bin = tmp_path / "venv" / "bin"
    venv_bin.mkdir(parents=True)
    (venv_bin / "ansible-playbook").write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")

    class _Result:
        returncode = 0

    monkeypatch.setattr(settings, "ssdv2_source", tmp_path)
    monkeypatch.setattr(ssdv2_bash.subprocess, "run", lambda *a, **k: _Result())
    assert ssdv2_bash._usable_venv_bin(settings) == venv_bin


def test_bash_environment_omits_broken_venv(settings, tmp_path, monkeypatch):
    venv_bin = tmp_path / "venv" / "bin"
    venv_bin.mkdir(parents=True)
    (venv_bin / "ansible-playbook").write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
    monkeypatch.setattr(settings, "ssdv2_source", tmp_path)
    monkeypatch.setattr(ssdv2_bash, "_usable_venv_bin", lambda _settings: None)

    environment = ssdv2_bash._bash_environment(settings)
    assert str(venv_bin) not in environment["PATH"].split(":")


def test_open_pty_disables_echo():
    master, slave = _open_pty()
    try:
        attrs = termios.tcgetattr(slave)
        assert not (attrs[3] & termios.ECHO)
    finally:
        os.close(master)
        os.close(slave)


def test_interactive_process_pty_prompt_and_no_echo():
    child = (
        "import sys; "
        "sys.stdout.write('Votre password Plex : '); sys.stdout.flush(); "
        "line = sys.stdin.readline().strip(); "
        "print('MATCH' if line == 's3cret' else 'NO')"
    )
    process = ssdv2_bash.InteractiveProcess([sys.executable, "-c", child], os.environ.copy())
    lines: list[str] = []
    prompts: list = []

    def on_prompt(spec, _raw):
        prompts.append(spec)
        process.write("s3cret")

    exit_code = process.run(
        on_line=lines.append,
        on_prompt=on_prompt,
        detect_prompt=detect,
        timeout=10,
        idle_timeout=5,
    )

    assert exit_code == 0
    assert any(spec.id == "plex.password" for spec in prompts)
    joined = "\n".join(lines)
    assert "MATCH" in joined
    assert "s3cret" not in joined


def test_spawn_rejects_unknown_function(settings):
    runner = Ssdv2BashRunner(settings)
    with pytest.raises(Ssdv2CtlError):
        runner.spawn("rm", ["-rf", "/"])


def test_spawn_rejects_foreign_account_key(settings):
    runner = Ssdv2BashRunner(settings)
    with pytest.raises(Ssdv2CtlError):
        runner.spawn("manage_account_yml", ["user.domain", "evil.tld"], app="plex")


def test_spawn_rejects_invalid_value(settings):
    runner = Ssdv2BashRunner(settings)
    with pytest.raises(Ssdv2CtlError):
        runner.spawn("manage_account_yml", ["sub.plex.plex", "bad value"], app="plex")


def test_capture_rejects_unknown_function(settings):
    runner = Ssdv2BashRunner(settings)
    with pytest.raises(Ssdv2CtlError):
        runner.capture("launch_service", ["plex"])
