from app.auth.security import create_access_token, create_refresh_token
from tests.factories import auth_headers, make_user


def refresh_headers(raw_token):
    return {"Cookie": f"refresh_token={raw_token}"}


def test_logout_rejects_access_tokens_issued_before_it(client, db_session):
    user = make_user(db_session)
    refresh = create_refresh_token(db_session, user.id)
    headers = auth_headers(user)
    assert client.get("/auth/me", headers=headers).status_code == 200

    client.post("/auth/logout", headers=refresh_headers(refresh))

    assert client.get("/auth/me", headers=headers).status_code == 401


def test_other_devices_get_a_working_access_token_after_logout(client, db_session):
    user = make_user(db_session)
    phone = create_refresh_token(db_session, user.id)
    laptop = create_refresh_token(db_session, user.id)
    laptop_headers = auth_headers(user)

    client.post("/auth/logout", headers=refresh_headers(phone))

    # The laptop's old access token is gone too, but its refresh token still works
    assert client.get("/auth/me", headers=laptop_headers).status_code == 401
    refreshed = client.post("/auth/refresh", headers=refresh_headers(laptop))
    assert refreshed.status_code == 200
    new_headers = {"Authorization": f"Bearer {refreshed.json()['access_token']}"}
    assert client.get("/auth/me", headers=new_headers).status_code == 200


def test_logout_with_an_invalid_refresh_token_changes_nothing(client, db_session):
    user = make_user(db_session)
    headers = auth_headers(user)

    client.post("/auth/logout", headers=refresh_headers("not-a-token"))

    assert client.get("/auth/me", headers=headers).status_code == 200


def test_access_token_without_a_version_is_rejected(client, db_session):
    # Tokens issued before token_version existed have no "ver" claim
    user = make_user(db_session)
    token = create_access_token(data={"sub": str(user.id)})

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
