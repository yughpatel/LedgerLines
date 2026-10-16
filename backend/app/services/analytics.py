from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Sequence

from sqlalchemy import Row, case, func, select, desc
from sqlalchemy.orm import Session

from app.core.config import REPORTING_TIMEZONE, REPORTING_TIMEZONE_NAME
from app.models.category import Category
from app.models.transaction import Transaction, TransactionType
from app.schemas.analytics import TrendBucket

CENTS = Decimal("0.01")


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


def get_trend(
    current_user_id: int,
    session: Session,
    year: int,
    month: int,
    bucket: TrendBucket,
) -> list[dict]:
    """
    Income and spending (DEBIT minus REFUND) per day or week of one IST calendar
    month, oldest first.

    Every bucket in the month is returned, with 0.00 where nothing happened. Week
    buckets start on Monday and are clipped to the month, so the first and last can
    be shorter than 7 days, but all buckets always add up to the month's total.
    """
    month_start = date(year, month, 1)
    next_month_start = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    # Boundaries are IST midnights compared against the raw column, so the filter
    # stays index-friendly and agrees with the buckets below
    range_start = datetime.combine(month_start, time.min, tzinfo=REPORTING_TIMEZONE)
    range_end = datetime.combine(next_month_start, time.min, tzinfo=REPORTING_TIMEZONE)

    # AT TIME ZONE turns the stored moment into IST wall-clock time before truncating.
    # Without it Postgres truncates in the session timezone, which differs per server
    local_time = func.timezone(REPORTING_TIMEZONE_NAME, Transaction.transaction_date)
    bucket_start = func.date_trunc(bucket.value, local_time).label("bucket_start")
    stmt = (
        select(
            bucket_start,
            func.sum(
                case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)
            ).label("income"),
            func.sum(
                case(
                    (Transaction.type == TransactionType.DEBIT, Transaction.amount),
                    (Transaction.type == TransactionType.REFUND, -Transaction.amount),
                    else_=0,
                )
            ).label("spending"),
        )
        .where(
            Transaction.user_id == current_user_id,
            Transaction.transaction_date >= range_start,
            Transaction.transaction_date < range_end,
        )
        # Grouped by the label: repeating the expression would bind the timezone name
        # as a second parameter, and Postgres would treat it as a different expression
        .group_by("bucket_start")
    )
    totals = {row.bucket_start.date(): row for row in session.execute(stmt)}

    step = timedelta(weeks=1) if bucket == TrendBucket.WEEK else timedelta(days=1)
    # Week keys from SQL are Mondays, so the loop starts on the Monday of the first
    # week, not on the 1st, or the first week's rows would never be matched
    cursor = month_start
    if bucket == TrendBucket.WEEK:
        cursor -= timedelta(days=month_start.weekday())

    buckets = []
    while cursor < next_month_start:
        row = totals.get(cursor)
        buckets.append({
            "start": max(cursor, month_start),
            "end": min(cursor + step, next_month_start),
            # Quantized so empty and income-only buckets read 0.00, not 0
            "income": (row.income if row else Decimal(0)).quantize(CENTS),
            "spending": (row.spending if row else Decimal(0)).quantize(CENTS),
        })
        cursor += step
    return buckets
