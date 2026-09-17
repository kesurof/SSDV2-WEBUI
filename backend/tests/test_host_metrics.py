from app.schemas.system import MemoryMetric
from app.services.docker_state import ContainerInfo, DockerSnapshot
from app.services.host_metrics import (
    container_metrics,
    cpu_percent,
    parse_cpu_times,
    parse_memory,
)

STAT_SAMPLE = """cpu  100 0 50 1000 20 0 10 0 0 0
cpu0 50 0 25 500 10 0 5 0 0 0
intr 123
"""


def test_parse_cpu_times_aggregates():
    assert parse_cpu_times(STAT_SAMPLE) == (1180, 1020)


def test_parse_cpu_times_without_cpu_line():
    assert parse_cpu_times("intr 1\n") is None


def test_parse_cpu_times_invalid_values():
    assert parse_cpu_times("cpu  a b c d\n") is None


def test_cpu_percent():
    assert cpu_percent((1000, 900), (1200, 1050)) == 25.0


def test_cpu_percent_zero_delta():
    assert cpu_percent((1000, 900), (1000, 900)) is None


def test_parse_memory():
    metric = parse_memory("MemTotal:       1000 kB\nMemAvailable:    400 kB\n")
    assert metric == MemoryMetric(
        total_bytes=1000 * 1024,
        used_bytes=600 * 1024,
        percent=60.0,
    )


def test_parse_memory_without_total():
    assert parse_memory("MemFree: 10 kB\n") == MemoryMetric()


def test_container_metrics():
    snapshot = DockerSnapshot(
        containers=[
            ContainerInfo("a", "img", "running", "healthy", None),
            ContainerInfo("b", "img", "running", None, None),
            ContainerInfo("c", "img", "running", "unhealthy", None),
            ContainerInfo("d", "img", "exited", None, None),
        ],
        error=None,
    )
    metrics = container_metrics(snapshot)
    assert metrics.total == 4
    assert metrics.running == 3
    assert metrics.healthy == 1
    assert metrics.unhealthy == 1
    assert metrics.stopped == 1


def test_container_metrics_without_snapshot():
    metrics = container_metrics(None)
    assert metrics.total == 0
