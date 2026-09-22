import re
from dataclasses import dataclass, field

ANSI_PATTERN = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


@dataclass(frozen=True)
class PromptSpec:
    id: str
    label: str
    kind: str = "text"
    secret: bool = False
    default: str = ""
    options: tuple[tuple[str, str], ...] = field(default_factory=tuple)


def strip_ansi(text: str) -> str:
    return ANSI_PATTERN.sub("", text).replace("\r", "")


def _rule(pattern: str, spec: PromptSpec) -> tuple[re.Pattern[str], PromptSpec]:
    return re.compile(pattern, re.IGNORECASE), spec


RULES: tuple[tuple[re.Pattern[str], PromptSpec], ...] = (
    _rule(r"Votre login Plex", PromptSpec("plex.login", "Login Plex")),
    _rule(
        r"Votre password Plex",
        PromptSpec("plex.password", "Mot de passe Plex", kind="secret", secret=True),
    ),
    _rule(
        r"APPUYER SUR ENTREE",
        PromptSpec("pause.enter", "Appuyer sur Entrée pour continuer", kind="confirm"),
    ),
    _rule(
        r"Conserver les données",
        PromptSpec("app.keep_data", "Conserver les données ?", kind="confirm", default="o"),
    ),
    _rule(
        r"\(o\s*/\s*n\)|\(y\s*/\s*n\)",
        PromptSpec("confirm.yesno", "Confirmer ?", kind="confirm", default="o"),
    ),
    _rule(
        r"Authentification .{1,40}\[ ?Enter ?\]",
        PromptSpec(
            "app.auth",
            "Authentification",
            kind="choice",
            default="5",
            options=(
                ("1", "basique"),
                ("2", "oauth"),
                ("3", "authelia"),
                ("4", "aucune"),
                ("5", "oauth2-proxy"),
            ),
        ),
    ),
    _rule(r"Sous[- ]domaine pour[^:]*", PromptSpec("app.subdomain", "Sous-domaine")),
    _rule(r"Votre choix", PromptSpec("app.choice", "Votre choix")),
    _rule(r"EXCLUDEPATH", PromptSpec("app.exclude_path", "Chemin à exclure")),
    _rule(
        r"TMDB_API_KEY|clé TMDB|TMDB",
        PromptSpec("app.tmdb", "Clé TMDB", kind="secret", secret=True),
    ),
    _rule(
        r"SECRET_API_KEY",
        PromptSpec("app.secret_key", "Clé secrète", kind="secret", secret=True),
    ),
    _rule(
        r"ADMIN_KEY",
        PromptSpec("app.admin_key", "Clé d'administration", kind="secret", secret=True),
    ),
    _rule(
        r"Nom d'utilisateur pour Dozzle",
        PromptSpec("dozzle.username", "Nom d'utilisateur Dozzle"),
    ),
    _rule(
        r"Mot de passe pour Dozzle",
        PromptSpec("dozzle.password", "Mot de passe Dozzle", kind="secret", secret=True),
    ),
    _rule(r"Beszel", PromptSpec("beszel.value", "Paramètre Beszel")),
    _rule(
        r"TRAKT_CLIENT",
        PromptSpec("trakt.value", "Identifiant Trakt", kind="secret", secret=True),
    ),
    _rule(r"YGG_USERNAME", PromptSpec("ygg.username", "Identifiant YGG")),
    _rule(
        r"YGG_PASSWORD",
        PromptSpec("ygg.password", "Mot de passe YGG", kind="secret", secret=True),
    ),
    _rule(r"Alldebrid|AllDebrid", PromptSpec("alldebrid.value", "Alldebrid")),
    _rule(r"nzbdav", PromptSpec("nzbdav.value", "Paramètre NZBDAV")),
    _rule(
        r"password|mot de passe|passphrase|secret|token|api[ _]?key|clé",
        PromptSpec("generic.secret", "Valeur", kind="secret", secret=True),
    ),
    _rule(r"login|username|identifiant|utilisateur", PromptSpec("generic.text", "Identifiant")),
)


def _best_match(cleaned: str, rules) -> tuple[int, int, PromptSpec, str] | None:
    best: tuple[int, int, PromptSpec, str] | None = None
    for priority, (pattern, spec) in enumerate(rules):
        for match in pattern.finditer(cleaned):
            candidate = (match.end(), -priority, spec, match.group(0))
            if best is None or candidate[:2] > best[:2]:
                best = candidate
    return best


def detect(text: str) -> PromptSpec | None:
    cleaned = strip_ansi(text)
    specific = [(p, s) for p, s in RULES if not s.id.startswith("generic")]
    generic = [(p, s) for p, s in RULES if s.id.startswith("generic")]
    best = _best_match(cleaned, specific) or _best_match(cleaned, generic)
    if best is None:
        return None
    _, _, spec, matched = best
    if spec.id.startswith("generic"):
        label = matched.strip()[:120] or spec.label
        return PromptSpec(spec.id, label, spec.kind, spec.secret, spec.default, spec.options)
    return spec


def to_payload(spec: PromptSpec, prompt_id: str) -> dict:
    return {
        "id": prompt_id,
        "spec": spec.id,
        "label": spec.label,
        "kind": spec.kind,
        "secret": spec.secret,
        "default": spec.default,
        "options": [{"value": value, "label": label} for value, label in spec.options],
    }
