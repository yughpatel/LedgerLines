from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.transaction import CategoryResponse

router = APIRouter(prefix="/categories", tags=["category"])


@router.get("", status_code=200, response_model=list[CategoryResponse])
async def list_categories(session: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """
    Returns an alphabetical list of system defaults and user-specific custom categories.
    """
    categories = session.query(Category).filter(
        or_(
            Category.user_id == current_user.id,
            Category.user_id.is_(None)
        )
    ).order_by(Category.name.asc()).all()

    return categories