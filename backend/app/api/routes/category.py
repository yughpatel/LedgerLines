from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryResponse, CategoryCreateRequest

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


@router.post("", status_code=201, response_model=CategoryResponse)
async def create_category(data: CategoryCreateRequest,
                          session: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """
    Creates a new custom category for the authenticated user.
    Rejects duplicates (case-insensitive) against both custom and system default categories.
    """
    existing_category = session.query(Category).filter(
        or_(
            Category.user_id == current_user.id,
            Category.user_id.is_(None)
        ),
        func.lower(Category.name) == data.name.lower()
    ).first()

    if existing_category:
        raise HTTPException(
            status_code=409,
            detail=f"A category named '{existing_category.name}' already exists."
        )

    new_category = Category(
        name=data.name,
        user_id=current_user.id
    )

    session.add(new_category)
    session.commit()
    session.refresh(new_category)

    return new_category