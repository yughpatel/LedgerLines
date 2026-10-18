import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.auth.security import create_access_token
from app.core.config import REPORTING_TIMEZONE
from app.models.category import Category
from app.models.transaction import Transaction, TransactionType
from app.models.user import User


def ist(wall_clock: str) -> datetime:
    """'2026-09-01 00:30' as an aware IST datetime. Tests use fixed dates, never today."""
    return datetime.fromisoformat(wall_clock).replace(tzinfo=REPORTING_TIMEZONE)


def make_user(session: Session, email: str | None = None) -> User:
    # Tests authenticate with auth_headers(), never by logging in, so the hash is a placeholder
    user = User(email=email or f"user-{uuid.uuid4().hex[:8]}@example.com", hashed_password="not-a-real-hash")
    session.add(user)
    session.flush()
    return user


def make_category(session: Session, user: User, name: str = "General") -> Category:
    # Reuses an existing one: names are unique per user, ignoring case
    category = session.query(Category).filter_by(user_id=user.id, name=name).first()
    if category is None:
        category = Category(name=name, user_id=user.id)
        session.add(category)
        session.flush()
    return category


def make_transaction(
    session: Session,
    user: User,
    type: TransactionType,
    amount: str | Decimal,
    at: str | datetime,
    category: Category | None = None,
) -> Transaction:
    """
    Insert one transaction. `at` is IST wall-clock time, e.g. '2026-09-30 23:59:59.999999',
    or an aware datetime for tests that must not depend on REPORTING_TIMEZONE.

    Amounts must be str or Decimal. A float would hide rounding errors in the very sums
    these tests exist to check.
    """
    if isinstance(amount, float):
        raise TypeError("Pass amount as a str or Decimal, not a float.")
    # A naive datetime would be read in the DB session's timezone, which differs per server
    if isinstance(at, datetime) and at.tzinfo is None:
        raise TypeError("Pass an aware datetime, or an IST wall-clock string.")
    transaction = Transaction(
        user_id=user.id,
        category_id=(category or make_category(session, user)).id,
        type=type,
        amount=Decimal(amount),
        transaction_date=ist(at) if isinstance(at, str) else at,
    )
    session.add(transaction)
    session.flush()
    return transaction


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(data={'sub': str(user.id)})}"}
