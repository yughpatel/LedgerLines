"""
The IST calendar month a report covers.

Shared by the summary, the trend and the category endpoints, so all three accept
the same year and month and reject the same bad input.
"""
from datetime import datetime

from fastapi import HTTPException, status

from app.core.config import REPORTING_TIMEZONE


def resolve_month(year: int | None, month: int | None) -> tuple[int, int]:
    """
    The month to report on. Pass both year and month, or neither for the current
    IST month. The month in progress is allowed; anything after it isn't. Compared
    in IST, so the cutoff matches the user's calendar near midnight on the 31st.
    """
    now = datetime.now(REPORTING_TIMEZONE)
    if year is None and month is None:
        return now.year, now.month
    if year is None or month is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Pass both year and month, or neither.",
        )
    if (year, month) > (now.year, now.month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="month cannot be in the future.",
        )
    return year, month


def month_range(year: int, month: int) -> tuple[datetime, datetime]:
    """
    IST midnight on the 1st, and IST midnight on the 1st of the next month.
    Use as a half-open range (start <= t < end), so a transaction at 00:30 IST on
    the 1st lands in the new month and nothing falls between two months.
    """
    start = datetime(year, month, 1, tzinfo=REPORTING_TIMEZONE)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=REPORTING_TIMEZONE)
    else:
        end = datetime(year, month + 1, 1, tzinfo=REPORTING_TIMEZONE)
    return start, end
