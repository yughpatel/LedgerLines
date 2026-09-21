from typing import Sequence

from sqlalchemy import Row, func, select, desc
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction, TransactionType


def get_spending_by_category(
    current_user_id: int,
    session: Session,
) -> Sequence[Row]:
    """
    Per-category DEBIT totals for the given user, biggest first.

    Inner-joined on Category, so a category with no DEBIT rows simply produces
    no group — that gives us "hide zero-spend categories" for free with no
    extra filter.
    """
    stmt = (
        select(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Category.id == Transaction.category_id)
        .where(
            Transaction.user_id == current_user_id,
            Transaction.type == TransactionType.DEBIT,
        )
        # Postgres requires every non-aggregated column in the SELECT to appear here.
        # Grouping by id alone would make Category.name illegal to select.
        .group_by(Category.id, Category.name)
        .order_by(desc("total"))
    )
    return session.execute(stmt).all()
