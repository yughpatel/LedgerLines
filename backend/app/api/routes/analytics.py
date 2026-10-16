from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.core.config import REPORTING_TIMEZONE
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    CategoryIncomeResponse,
    CategorySpendingResponse,
    TrendBucket,
    TrendBucketResponse,
)
from app.services.analytics import get_income_by_category, get_spending_by_category, get_trend

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/spending-by-category",
    status_code=status.HTTP_200_OK,
    response_model=list[CategorySpendingResponse],
)
def list_spending_by_category(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category spending (DEBIT minus REFUND) for the signed-in user, all-time, biggest first.
    Categories with no spending left after refunds are omitted.
    """
    rows = get_spending_by_category(current_user.id, session)
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
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category CREDIT totals for the signed-in user, all-time, biggest first.
    Categories with no CREDIT rows are omitted.
    """
    rows = get_income_by_category(current_user.id, session)
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
    year: Optional[int] = Query(default=None, ge=2020),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    bucket: TrendBucket = TrendBucket.DAY,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Income and spending per day or week for one IST calendar month.
    Defaults to the current month. Pass both year and month, or neither.
    """
    now = datetime.now(REPORTING_TIMEZONE)
    if year is None and month is None:
        year, month = now.year, now.month
    elif year is None or month is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Pass both year and month, or neither.",
        )

    # The month in progress is allowed; anything after it isn't. Compared in IST,
    # so the cutoff matches the user's calendar near midnight on the 31st
    if (year, month) > (now.year, now.month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="month cannot be in the future.",
        )

    buckets = get_trend(current_user.id, session, year, month, bucket)
    return [TrendBucketResponse(**b) for b in buckets]
