from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
import jwt

from app.auth.security import create_access_token, create_refresh_token, hash_refresh_token, verify_refresh_token
from app.core.config import settings
from app.models.refresh_token import RefreshToken
from tests.factories import make_user

@pytest.fixture
def same_second(monkeypatch):
    # Pins token creation to one whole second, the case where exp alone can't tell
    # two tokens apart. Real now, so the tokens are still unexpired when decoded
    frozen = datetime.now(timezone.utc).replace(microsecond=0)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen.astimezone(tz) if tz else frozen.replace(tzinfo=None)

    monkeypatch.setattr("app.auth.security.datetime", FrozenDatetime)


def refresh_headers(raw_token):
    return {"Cookie": f"refresh_token={raw_token}"}


def test_two_tokens_in_the_same_second_are_distinct_and_never_match(db_session, same_second):
    user = make_user(db_session)

    first = create_refresh_token(db_session, user.id)
    second = create_refresh_token(db_session, user.id)

    assert first != second
    assert hash_refresh_token(first) != hash_refresh_token(second)
    _, first_row = verify_refresh_token(first, db_session)
    _, second_row = verify_refresh_token(second, db_session)
    assert first_row.id != second_row.id
    assert first_row.token_hash == hash_refresh_token(first)
    # Only the digest is stored, never the token itself
    assert first_row.token_hash != first and len(first_row.token_hash) == 64


def test_logout_revokes_only_its_own_session(client, db_session):
    user = make_user(db_session)
    phone = create_refresh_token(db_session, user.id)
    laptop = create_refresh_token(db_session, user.id)

    logout = client.post("/auth/logout", headers=refresh_headers(phone))

    assert logout.status_code == 200
    assert client.post("/auth/refresh", headers=refresh_headers(phone)).status_code == 401
    assert client.post("/auth/refresh", headers=refresh_headers(laptop)).status_code == 200


def test_revoked_token_fails_even_though_its_row_still_exists(db_session):
    user = make_user(db_session)
    raw = create_refresh_token(db_session, user.id)
    row = db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw)).one()
    row.revoked = True
    db_session.flush()

    with pytest.raises(HTTPException) as exc:
        verify_refresh_token(raw, db_session)

    assert exc.value.status_code == 401
    assert db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw)).count() == 1

def test_refresh_token_of_a_deleted_user_is_401(client, db_session):
    user = make_user(db_session)
    raw = create_refresh_token(db_session, user.id)
    db_session.delete(user)
    db_session.flush()

    response = client.post("/auth/refresh", headers=refresh_headers(raw))

    assert response.status_code == 401

def test_access_token_exp_is_now_plus_configured_minutes():
    before = datetime.now(timezone.utc)
    token = create_access_token(data={"sub": "1"})
    exp = datetime.fromtimestamp(
        jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])["exp"], timezone.utc
    )

    expected = before + timedelta(minutes=settings.access_token_expire_minutes)
    assert abs((exp - expected).total_seconds()) < 5