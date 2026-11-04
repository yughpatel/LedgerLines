import pytest
from pydantic import ValidationError

from app.core.config import Settings

STRONG = "s" * 32
OTHER_STRONG = "r" * 32


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    # Settings read the process environment; keep these tests about the values they pass
    for name in ("ENVIRONMENT", "CORS_ORIGINS", "REFRESH_COOKIE_PATH"):
        monkeypatch.delenv(name, raising=False)


def make_settings(**overrides) -> Settings:
    values = {
        "database_url": "postgresql://u:p@localhost:5432/x",
        "secret_key": STRONG,
        "algorithm": "HS256",
        "access_token_expire_minutes": 15,
        "refresh_token_secret_key": OTHER_STRONG,
        "refresh_token_expire_days": 7,
    } | overrides
    return Settings(_env_file=None, **values)


def test_safe_production_settings_are_accepted():
    s = make_settings(environment="production", cors_origins="https://ledgerlines.example")

    assert s.is_production
    assert s.cors_origins == ["https://ledgerlines.example"]


def test_production_allows_no_cors_origins_behind_the_proxy():
    assert make_settings(environment="production", cors_origins="").cors_origins == []


def test_unknown_environment_fails_instead_of_running_without_secure_cookies():
    with pytest.raises(ValidationError):
        make_settings(environment="prod")


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"secret_key": "short"}, "SECRET_KEY must be at least 32"),
        ({"refresh_token_secret_key": "short"}, "REFRESH_TOKEN_SECRET_KEY must be at least 32"),
        ({"refresh_token_secret_key": STRONG}, "must be different"),
        ({"cors_origins": "*"}, "can't be '*'"),
        ({"cors_origins": "http://ledgerlines.example"}, "must all be https://"),
    ],
)
def test_unsafe_production_settings_are_refused(overrides, message):
    overrides = {"cors_origins": "", **overrides}

    with pytest.raises(ValidationError, match=message):
        make_settings(environment="production", **overrides)


def test_development_allows_short_secrets_and_http_origins():
    s = make_settings(secret_key="dev", refresh_token_secret_key="dev", cors_origins="http://localhost:3000")

    assert not s.is_production


def test_cors_origins_are_read_comma_separated_from_the_environment(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://a.example/ , https://b.example,, ")

    assert make_settings().cors_origins == ["https://a.example", "https://b.example"]


def test_refresh_cookie_path_defaults_to_the_proxied_auth_routes():
    assert make_settings().refresh_cookie_path == "/api/auth"


def test_refresh_cookie_path_must_be_absolute():
    assert make_settings(refresh_cookie_path="/auth/").refresh_cookie_path == "/auth"
    with pytest.raises(ValidationError):
        make_settings(refresh_cookie_path="api/auth")
