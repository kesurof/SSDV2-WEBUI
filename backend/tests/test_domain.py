from app.adapters.ssdv2_cli import Ssdv2CtlError
from app.services import domain as domain_service
from tests.conftest import FakeRunner


def setup_function() -> None:
    domain_service.clear_domain_cache()


def test_domain_from_config():
    runner = FakeRunner(payload={"schema": 1, "key": "user.domain", "value": "example.com"})

    assert domain_service.get_global_domain(runner, None) == "example.com"
    assert runner.calls == [["config", "get", "user.domain"]]


def test_domain_cached_between_calls():
    runner = FakeRunner(payload={"value": "example.com"})

    domain_service.get_global_domain(runner, None)
    domain_service.get_global_domain(runner, None)

    assert len(runner.calls) == 1


def test_domain_falls_back_on_error():
    runner = FakeRunner(error=Ssdv2CtlError("ssdv2ctl_unavailable", "indisponible"))

    assert domain_service.get_global_domain(runner, "fallback.tld") == "fallback.tld"


def test_domain_falls_back_on_empty_value():
    runner = FakeRunner(payload={"value": ""})

    assert domain_service.get_global_domain(runner, "fallback.tld") == "fallback.tld"
