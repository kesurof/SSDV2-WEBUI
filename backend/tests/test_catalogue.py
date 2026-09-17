from app.services.catalogue import parse_catalogue, read_catalogue


def test_parse_catalogue_splits_name_and_description():
    entries = parse_catalogue("sonarr - Gestion Séries\nradarr - Gestion Films\n")
    assert [(entry.name, entry.description) for entry in entries] == [
        ("radarr", "Gestion Films"),
        ("sonarr", "Gestion Séries"),
    ]


def test_parse_catalogue_handles_missing_space_before_dash():
    entries = parse_catalogue("decypharrseed- decypharr Seed\n")
    assert entries[0].name == "decypharrseed"
    assert entries[0].description == "decypharr Seed"


def test_parse_catalogue_keeps_dashes_in_name():
    entries = parse_catalogue("ma-super-app - Description\n")
    assert entries[0].name == "ma-super-app"


def test_parse_catalogue_ignores_comments_and_blanks():
    assert parse_catalogue("# commentaire\n\n   \n") == []


def test_read_catalogue_missing_file(tmp_path):
    entries, error = read_catalogue(tmp_path / "absent")
    assert entries == []
    assert error is not None
