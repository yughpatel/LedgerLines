from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.category import Category


def validate_category(
    category_id: int,
    current_user_id: int,
    session: Session,
) -> Category:
    """
    Return a Category the user may reference: their own, or a system default.

    Missing and someone else's both return 404, so ids aren't leaked.
    """
    category = session.query(Category).filter(
        Category.id == category_id,
        or_(
            Category.user_id == current_user_id,
            Category.user_id.is_(None),
        ),
    ).first()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def get_owned_category(
    category_id: int,
    current_user_id: int,
    session: Session,
) -> Category:
    """
    Return a category the user personally owns, or raise 404.

    Stricter than validate_category, which also allows system defaults — those are
    shared, so no one user may delete them.
    """
    category = session.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user_id,
    ).first()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category
