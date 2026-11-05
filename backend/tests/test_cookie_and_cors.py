import uuid

from app.core.config import settings


def log_in(client):
    email = f"cookie-{uuid.uuid4().hex[:8]}@example.com"
    signup = client.post("/auth/signup", json={"email": email, "password": "Str0ng!pass"})
    assert signup.status_code == 201, signup.text
    login = client.post("/auth/login", json={"email": email, "password": "Str0ng!pass"})
    assert login.status_code == 200, login.text
    return login


def cookie_attributes(response) -> dict[str, str]:
    header = next(h for h in response.headers.get_list("set-cookie") if h.startswith("refresh_token="))
    attrs = {}
    for part in header.split(";")[1:]:
        key, _, value = part.strip().partition("=")
        attrs[key.lower()] = value
    return attrs


def test_refresh_cookie_is_scoped_to_the_proxied_auth_path(client):
    attrs = cookie_attributes(log_in(client))

    assert attrs["path"] == "/api/auth"
    assert "httponly" in attrs
    assert attrs["samesite"].lower() == "lax"
    assert "secure" not in attrs  # development; production is covered by is_production


def test_logout_clears_the_cookie_at_the_same_path(client):
    login = log_in(client)
    raw = login.cookies["refresh_token"]
    client.cookies.clear()

    logout = client.post("/auth/logout", headers={"Cookie": f"refresh_token={raw}"})

    attrs = cookie_attributes(logout)
    assert attrs["path"] == "/api/auth"
    assert attrs["max-age"] == "0"


def test_refresh_cookie_path_follows_the_setting(client, monkeypatch):
    monkeypatch.setattr(settings, "refresh_cookie_path", "/auth")

    assert cookie_attributes(log_in(client))["path"] == "/auth"


def test_secure_flag_is_set_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")

    assert "secure" in cookie_attributes(log_in(client))


def preflight(client, origin):
    return client.options(
        "/auth/login",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )


def test_cors_allows_a_configured_origin_with_credentials(client):
    response = preflight(client, "http://localhost:3000")

    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_ignores_an_origin_that_is_not_configured(client):
    response = preflight(client, "https://evil.example")

    assert "access-control-allow-origin" not in response.headers
