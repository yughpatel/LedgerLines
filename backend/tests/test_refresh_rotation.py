import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Response
from sqlalchemy.orm import Session

from app.api.routes import auth as auth_routes
from app.auth.security import create_refresh_token, hash_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.user import User
from tests.factories import auth_headers, make_user


def refresh(client, raw_token):
    # The client keeps cookies a response sets; clearing them means each call sends
    # exactly the token the test names, not one left over from an earlier rotation
    client.cookies.clear()
    return client.post("/auth/refresh", headers={"Cookie": f"refresh_token={raw_token}"})


def logout(client, raw_token):
    client.cookies.clear()
    return client.post("/auth/logout", headers={"Cookie": f"refresh_token={raw_token}"})


def row_for(db_session, raw_token):
    return db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw_token)).one()


def rotate(client, raw_token):
    response = refresh(client, raw_token)
    assert response.status_code == 200
    return response.cookies["refresh_token"]


def test_refresh_rotates_the_token(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)

    second = rotate(client, first)

    assert second != first
    old, new = row_for(db_session, first), row_for(db_session, second)
    assert old.revoked and old.replaced_at is not None and old.replaced_by_id == new.id
    assert not new.revoked
    assert refresh(client, second).status_code == 200


def test_rotated_token_keeps_the_original_expiry(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)

    second = rotate(client, first)

    assert row_for(db_session, second).expires_at == row_for(db_session, first).expires_at


def test_rotated_cookie_expires_with_its_token(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)
    # As if the session started six days ago: one day left
    row_for(db_session, first).expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    db_session.flush()

    response = refresh(client, first)

    cookie = response.headers["set-cookie"]
    max_age = int(cookie.split("Max-Age=")[1].split(";")[0])
    assert abs(max_age - 24 * 60 * 60) < 5


def test_token_revoked_by_logout_is_401_without_ending_other_sessions(client, db_session):
    user = make_user(db_session)
    phone = create_refresh_token(db_session, user.id)
    laptop = create_refresh_token(db_session, user.id)
    logout(client, phone)

    assert refresh(client, phone).status_code == 401
    # Only the logout's own increment, no mass revoke on top of it
    assert user.token_version == 1
    assert refresh(client, laptop).status_code == 200


def test_just_rotated_token_gets_an_access_token_but_no_new_cookie(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)
    second = rotate(client, first)

    response = refresh(client, first)

    assert response.status_code == 200
    assert "refresh_token" not in response.cookies
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/me", headers=headers).status_code == 200
    # The other tab's replacement is untouched
    assert not row_for(db_session, second).revoked


def test_grace_period_does_not_undo_a_logout(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)
    second = rotate(client, first)
    logout(client, second)

    assert refresh(client, first).status_code == 401


def test_reusing_an_old_rotated_token_ends_every_session(client, db_session):
    user = make_user(db_session)
    first = create_refresh_token(db_session, user.id)
    laptop = create_refresh_token(db_session, user.id)
    old_access = auth_headers(user)
    second = rotate(client, first)
    # Moved back instead of sleeping: the grace period is over
    old = row_for(db_session, first)
    old.replaced_at -= auth_routes.ROTATION_GRACE + timedelta(seconds=1)
    db_session.flush()

    response = refresh(client, first)

    assert response.status_code == 401
    assert user.token_version == 1
    assert client.get("/auth/me", headers=old_access).status_code == 401
    assert refresh(client, second).status_code == 401
    assert refresh(client, laptop).status_code == 401
    assert db_session.query(RefreshToken).filter_by(user_id=user.id, revoked=False).count() == 0


def committed_user_with_token(db_engine, prefix):
    with Session(db_engine) as setup:
        user = User(email=f"{prefix}-{uuid.uuid4().hex[:8]}@example.com", hashed_password="not-a-real-hash")
        setup.add(user)
        setup.commit()
        return user.id, create_refresh_token(setup, user.id)


def delete_user(db_engine, user_id):
    with Session(db_engine) as cleanup:
        # Refresh tokens go with it (ON DELETE CASCADE)
        cleanup.query(User).filter_by(id=user_id).delete()
        cleanup.commit()


def test_reuse_revocation_survives_the_401(db_engine):
    """
    The reuse path raises after changing the database. A real request's session is
    thrown away afterwards, so anything not committed before the raise is lost. The
    usual test session is shared and never thrown away, so it can't catch that; this
    uses a fresh session per request, like get_db does.
    """
    user_id, first = committed_user_with_token(db_engine, "reuse")
    try:
        with Session(db_engine) as db:
            auth_routes.refresh_token_route(response=Response(), db=db, refresh_token=first)
        with Session(db_engine) as db:
            old = db.query(RefreshToken).filter_by(token_hash=hash_refresh_token(first)).one()
            old.replaced_at -= auth_routes.ROTATION_GRACE + timedelta(seconds=1)
            db.commit()

        with Session(db_engine) as db, pytest.raises(HTTPException) as exc:
            auth_routes.refresh_token_route(response=Response(), db=db, refresh_token=first)
        assert exc.value.status_code == 401

        with Session(db_engine) as check:
            assert check.query(RefreshToken).filter_by(user_id=user_id, revoked=False).count() == 0
            assert check.get(User, user_id).token_version == 1
    finally:
        delete_user(db_engine, user_id)


def test_two_refreshes_at_once_rotate_the_token_only_once(db_engine, monkeypatch):
    """
    Two tabs sending the same cookie at the same moment. The lock in find_refresh_token
    makes the second wait, then see the token as just rotated and take the grace path.
    Without the lock both would see it active and rotate it, leaving two live tokens.

    Uses its own committed rows and two real connections: the usual rolled-back test
    session is a single connection, and a lock only matters between two.
    """
    user_id, raw = committed_user_with_token(db_engine, "race")
    real_create = auth_routes.create_refresh_token

    def slow_create(*args, **kwargs):
        # Holds the first request inside its transaction, lock taken, long enough
        # for the second to arrive while the row is still unrotated on disk
        time.sleep(0.5)
        return real_create(*args, **kwargs)

    monkeypatch.setattr(auth_routes, "create_refresh_token", slow_create)
    results = []

    def tab():
        with Session(db_engine) as db:
            try:
                auth_routes.refresh_token_route(response=Response(), db=db, refresh_token=raw)
                results.append(200)
            except HTTPException as exc:
                results.append(exc.status_code)

    try:
        first_tab = threading.Thread(target=tab)
        second_tab = threading.Thread(target=tab)
        first_tab.start()
        time.sleep(0.2)
        second_tab.start()
        first_tab.join(timeout=10)
        second_tab.join(timeout=10)

        assert results == [200, 200]
        with Session(db_engine) as check:
            rows = check.query(RefreshToken).filter_by(user_id=user_id).all()
            assert len(rows) == 2
            assert sum(not row.revoked for row in rows) == 1
    finally:
        delete_user(db_engine, user_id)
