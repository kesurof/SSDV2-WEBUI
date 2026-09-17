import sqlite3

from app.services.ssddb import read_ssddb


def _create_db(path):
    with sqlite3.connect(path) as conn:
        conn.execute(
            "create table applications("
            "name varchar(50) primary key, status integer, subdomain varchar(50), port integer)"
        )
        conn.execute(
            "create table seedbox_params(param varchar(50) primary key, value varchar(50))"
        )
        conn.execute("insert into seedbox_params values ('domain', 'example.com')")
        conn.execute("insert into applications values ('sonarr', 2, 'sonarr', 8989)")


def test_read_ssddb(tmp_path):
    path = tmp_path / "ssddb"
    _create_db(path)

    data = read_ssddb(path)

    assert data.domain == "example.com"
    assert data.warnings == []
    assert data.applications["sonarr"].subdomain == "sonarr"
    assert data.applications["sonarr"].port == 8989


def test_read_ssddb_missing_file(tmp_path):
    data = read_ssddb(tmp_path / "absent")
    assert data.applications == {}
    assert data.warnings


def test_read_ssddb_invalid_file(tmp_path):
    path = tmp_path / "ssddb"
    path.write_text("pas une base sqlite", encoding="utf-8")
    data = read_ssddb(path)
    assert data.applications == {}
    assert data.warnings
