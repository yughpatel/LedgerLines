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
    Return the Category the current user is allowed to reference, or raise 404.

    A user may reference:
      - their own custom category (category.user_id == current_user_id), or
      - a system-default category (category.user_id IS NULL, shared by all users).

    A category that doesn't exist, or belongs to another user, both surface as 404 —
    we deliberately do not distinguish those cases so we don't leak the existence
    of another user's private categories.
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
