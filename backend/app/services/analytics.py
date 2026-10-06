from typing import Sequence

from sqlalchemy import Row, case, func, select, desc
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction, TransactionType


def get_spending_by_category(
    current_user_id: int,
    session: Session,
) -> Sequence[Row]:
    """
    Per-category spending for the given user (DEBIT minus REFUND), biggest first.

    Inner-joined on Category, so a category with no DEBIT or REFUND rows simply
    produces no group. Categories that net to zero or below are dropped too.
    """
    # Refund amounts are stored positive like debits, so the sign is applied here
    total = func.sum(
        case(
            (Transaction.type == TransactionType.REFUND, -Transaction.amount),
            else_=Transaction.amount,
        )
    )
    stmt = (
        select(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            total.label("total"),
        )
        .select_from(Transaction)
        .join(Category, Category.id == Transaction.category_id)
        .where(
            Transaction.user_id == current_user_id,
            Transaction.type.in_([TransactionType.DEBIT, TransactionType.REFUND]),
        )
        # Postgres requires every non-aggregated column in the SELECT to appear here.
        # Grouping by id alone would make Category.name illegal to select.
        .group_by(Category.id, Category.name)
        # A fully refunded category has nothing to chart. A negative total means more
        # was refunded than spent, which is a data entry error this also hides
        .having(total > 0)
        # Tie-breakers keep equal totals in a stable order so the chart doesn't reshuffle
        .order_by(desc("total"), Category.name, Category.id)
    )
    return session.execute(stmt).all()


def get_income_by_category(
    current_user_id: int,
    session: Session,
) -> Sequence[Row]:
    """
    Per-category CREDIT totals for the given user, biggest first.

    Mirror of get_spending_by_category with the type flipped - same inner join,
    so categories with no CREDIT rows are omitted.
    """
    stmt = (
        select(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.sum(Transaction.amount).label("total"),
        )
        .select_from(Transaction)
        .join(Category, Category.id == Transaction.category_id)
        .where(
            Transaction.user_id == current_user_id,
            Transaction.type == TransactionType.CREDIT,
        )
        .group_by(Category.id, Category.name)
        .order_by(desc("total"), Category.name, Category.id)
    )
    return session.execute(stmt).all()
