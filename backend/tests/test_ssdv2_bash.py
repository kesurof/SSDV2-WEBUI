import pytest

from app.adapters import ssdv2_bash
from app.adapters.ssdv2_bash import Ssdv2BashRunner
from app.adapters.ssdv2_cli import Ssdv2CtlError


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
