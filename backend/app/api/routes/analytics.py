from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    CategoryIncomeResponse,
    CategorySpendingResponse,
    TrendBucket,
    TrendBucketResponse,
)
from app.services.analytics import get_income_by_category, get_spending_by_category, get_trend
from app.services.period import month_range, resolve_month

router = APIRouter(prefix="/analytics", tags=["analytics"])

YearParam = Query(default=None, ge=2020)
MonthParam = Query(default=None, ge=1, le=12)


def _range_or_all_time(year: Optional[int], month: Optional[int]) -> tuple[datetime | None, datetime | None]:
    # No year and month keeps these endpoints all-time, as they were before the
    # month filter existed. Anything else must be a valid, non-future month
    if year is None and month is None:
        return None, None
    return month_range(*resolve_month(year, month))


@router.get(
    "/spending-by-category",
    status_code=status.HTTP_200_OK,
    response_model=list[CategorySpendingResponse],
)
def list_spending_by_category(
    year: Optional[int] = YearParam,
    month: Optional[int] = MonthParam,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category spending (DEBIT minus REFUND) for the signed-in user, biggest first.
    All-time by default; pass year and month for one IST calendar month.
    All-time, categories with no spending left after refunds are omitted. For one
    month only zero totals are omitted, so a refund for an earlier month's purchase
    shows as a negative total and the categories add up to the summary's total_spent.
    """
    start, end = _range_or_all_time(year, month)
    rows = get_spending_by_category(current_user.id, session, start, end)
    return [
        CategorySpendingResponse(
            category_id=row.category_id,
            category_name=row.category_name,
            total=row.total,
        )
        for row in rows
    ]


@router.get(
    "/income-by-category",
    status_code=status.HTTP_200_OK,
    response_model=list[CategoryIncomeResponse],
)
def list_income_by_category(
    year: Optional[int] = YearParam,
    month: Optional[int] = MonthParam,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category CREDIT totals for the signed-in user, biggest first.
    All-time by default; pass year and month for one IST calendar month.
    Categories with no CREDIT rows are omitted.
    """
    start, end = _range_or_all_time(year, month)
    rows = get_income_by_category(current_user.id, session, start, end)
    return [
        CategoryIncomeResponse(
            category_id=row.category_id,
            category_name=row.category_name,
            total=row.total,
        )
        for row in rows
    ]


@router.get(
    "/trend",
    status_code=status.HTTP_200_OK,
    response_model=list[TrendBucketResponse],
)
def get_trend_over_time(
    year: Optional[int] = YearParam,
    month: Optional[int] = MonthParam,
    bucket: TrendBucket = TrendBucket.DAY,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Income and spending per day or week for one IST calendar month.
    Defaults to the current month. Pass both year and month, or neither.
    """
    year, month = resolve_month(year, month)
    buckets = get_trend(current_user.id, session, year, month, bucket)
    return [TrendBucketResponse(**b) for b in buckets]
