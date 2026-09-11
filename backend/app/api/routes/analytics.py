from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import CategorySpendingResponse
from app.services.analytics import get_spending_by_category

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/spending-by-category",
    status_code=status.HTTP_200_OK,
    response_model=list[CategorySpendingResponse],
)
async def list_spending_by_category(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category DEBIT totals for the signed-in user, all-time, biggest first.
    Categories with no DEBIT rows are omitted.
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
