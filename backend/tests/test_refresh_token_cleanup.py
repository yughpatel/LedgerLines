from datetime import datetime, timedelta, timezone

from app.auth.security import create_refresh_token, hash_password, hash_refresh_token
from app.models.refresh_token import RefreshToken
from tests.factories import make_user

PASSWORD = "Secret1!"


def user_who_can_log_in(db_session):
    # make_user stores a placeholder hash; these tests go through the real /auth/login
    user = make_user(db_session)
    user.hashed_password = hash_password(PASSWORD)
    db_session.flush()
    return user


def login(client, user):
    client.cookies.clear()
    response = client.post("/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return response


def token_with(db_session, user, *, expired=False, revoked=False):
    raw = create_refresh_token(db_session, user.id)
    row = db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw)).one()
    if expired:
        row.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    row.revoked = revoked
    db_session.flush()
    return raw


def exists(db_session, raw):
    return db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw)).count() == 1


def test_login_deletes_the_users_expired_tokens(client, db_session):
    user = user_who_can_log_in(db_session)
    expired = token_with(db_session, user, expired=True)
    expired_and_revoked = token_with(db_session, user, expired=True, revoked=True)

    login(client, user)

    assert not exists(db_session, expired)
    assert not exists(db_session, expired_and_revoked)


def test_login_keeps_revoked_tokens_that_have_not_expired(client, db_session):
    # Reuse detection needs these rows until they expire
    user = user_who_can_log_in(db_session)
    revoked = token_with(db_session, user, revoked=True)
    active = token_with(db_session, user)

    login(client, user)

    assert exists(db_session, revoked)
    assert exists(db_session, active)


def test_login_leaves_other_users_tokens_alone(client, db_session):
    user = user_who_can_log_in(db_session)
    other = make_user(db_session)
    others_expired = token_with(db_session, other, expired=True)

    login(client, user)

    assert exists(db_session, others_expired)


def test_expired_rotation_chain_is_deleted_whole(client, db_session):
    # Each row points at its replacement; SET NULL lets them go in one delete
    user = user_who_can_log_in(db_session)
    first = create_refresh_token(db_session, user.id)
    client.cookies.clear()
    second = client.post("/auth/refresh", headers={"Cookie": f"refresh_token={first}"}).cookies["refresh_token"]
    for raw in (first, second):
        row = db_session.query(RefreshToken).filter_by(token_hash=hash_refresh_token(raw)).one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.flush()

    login(client, user)

    assert not exists(db_session, first)
    assert not exists(db_session, second)