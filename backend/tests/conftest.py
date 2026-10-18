import os
from datetime import datetime
from pathlib import Path

import pytest
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[1]


class _DatabaseUrlOnly(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    database_url: str
    test_database_url: str | None = None


# Resolved before anything imports `app`: app/__init__.py builds the engine at import
# time, so DATABASE_URL has to point at the test database first
_env = _DatabaseUrlOnly()
_test_url = make_url(_env.test_database_url or _env.database_url)
if not _env.test_database_url:
    _test_url = _test_url.set(database="ledgerlines_test")

# Tests create and roll back rows freely; this stops them ever touching dev or scratch data
if not (_test_url.database or "").endswith("_test"):
    pytest.exit(f"Refusing to run: test database '{_test_url.database}' does not end in '_test'.", returncode=2)
# The name check alone would still allow a "_test" database on a remote or production host
if _test_url.host not in {"localhost", "127.0.0.1", "::1"}:
    pytest.exit(f"Refusing to run: test database host '{_test_url.host}' is not local.", returncode=2)

os.environ["DATABASE_URL"] = _test_url.render_as_string(hide_password=False)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402

# Second check on what the app actually connected to, in case something imported it early
if not (engine.url.database or "").endswith("_test"):
    pytest.exit(f"Refusing to run: app engine points at '{engine.url.database}'.", returncode=2)


@pytest.fixture(scope="session")
def db_engine():
    # Same migrations as production, so tests see the real enum, indexes and seeded defaults
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    try:
        command.upgrade(config, "head")
    except OperationalError as err:
        # Not echoing the driver message: a malformed URL can put password fragments in it
        hint = "Create it first (owner ledgerlines_user)." if "does not exist" in str(err.orig) else "Check TEST_DATABASE_URL."
        pytest.exit(f"Can't connect to test database '{engine.url.database}'. {hint}", returncode=2)
    return engine


@pytest.fixture
def db_session(db_engine):
    """
    A session inside a transaction that is rolled back after each test.

    Rollback instead of truncate: it's faster, and it keeps the system default
    categories the migrations seeded. create_savepoint lets route code call
    session.commit() without ending the outer transaction.
    """
    connection = db_engine.connect()
    outer = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    # get_current_user depends on get_db too, so this override covers auth lookups as well
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def freeze_now(monkeypatch):
    """
    Pin datetime.now() in the routes that read "today", given as IST wall-clock time.

    The summary and the trend default both depend on the current month, and a test that
    depends on the real date breaks on the 1st of some month for no visible reason.
    """
    from tests.factories import ist

    def freeze(wall_clock: str):
        frozen = ist(wall_clock)

        class FrozenDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return frozen.astimezone(tz) if tz else frozen.replace(tzinfo=None)

        monkeypatch.setattr("app.api.routes.transaction.datetime", FrozenDatetime)
        monkeypatch.setattr("app.api.routes.analytics.datetime", FrozenDatetime)

    return freeze
