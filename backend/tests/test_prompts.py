from app.services.prompts import detect, strip_ansi


def test_strip_ansi():
    assert strip_ansi("\x1b[1;37m###\x1b[0m ok") == "### ok"


def test_detect_plex_login_and_password():
    login = detect("\x1b[1m Votre login Plex (e-mail or username) : ")
    assert login is not None
    assert login.id == "plex.login"
    assert login.secret is False

    password = detect("Votre password Plex : ")
    assert password is not None
    assert password.id == "plex.password"
    assert password.secret is True


def test_detect_pause_and_confirm():
    assert detect("###  --> APPUYER SUR ENTREE POUR CONTINUER <--  ###").id == "pause.enter"
    confirm = detect("Supprimer les conteneurs orphelins listés ? (y/n) : ")
    assert confirm is not None
    assert confirm.kind == "confirm"


def test_detect_auth_choice():
    spec = detect(" --> Authentification sonarr [ Enter ] 1 => basique | 2 => oauth : ")
    assert spec is not None
    assert spec.kind == "choice"
    assert ("5", "oauth2-proxy") in spec.options


def test_detect_generic_secret():
    spec = detect("Please enter your TMDB_API_KEY")
    assert spec is not None
    assert spec.secret is True


def test_detect_returns_none_on_plain_output():
    assert detect("changed: [127.0.0.1]") is None


def test_specific_prompt_promoted_to_secret():
    password = detect("Entrer le password Alldebrid")
    assert password is not None
    assert password.secret is True

    api_key = detect("Entre ta clé API AllDebrid")
    assert api_key is not None
    assert api_key.secret is True
