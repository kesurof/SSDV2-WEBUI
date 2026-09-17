from app.core.logging import REDACTED, redact


def test_redact_masks_sensitive_keys():
    data = {
        "password": "secret-value",
        "cloudflare_token": "abc",
        "authorization": "Bearer x",
        "cookie": "session=1",
        "vault_password": "x",
        "domain": "example.com",
    }
    result = redact(data)
    assert result["domain"] == "example.com"
    for key in ("password", "cloudflare_token", "authorization", "cookie", "vault_password"):
        assert result[key] == REDACTED
