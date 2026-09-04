from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryResponse, CategoryCreateRequest
from app.services.category import get_owned_category

# Version-dependent: PG18+ raises 23001 for RESTRICT specifically (see PG commit
# "Fix error code for referential action RESTRICT", Dec 2024); PG16 and earlier
# raise 23503 for both RESTRICT and NO ACTION. Both codes handled for portability.
REFERENCED_BY_CHILD_ROW = frozenset({"23001", "23503"})

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


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(id: int,
                          session: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """
    Delete one of the user's own categories. 409 if transactions still reference it.

    Relies on the DB's RESTRICT rather than a pre-count, so nothing can slip in
    between checking and deleting.
    """
    category = get_owned_category(id, current_user.id, session)

    session.delete(category)
    try:
        session.commit()
    except IntegrityError as err:
        # A failed flush aborts the session; everything after it errors until rollback
        session.rollback()
        # Anything else is a real fault — 500 rather than mislabel it as "in use"
        if getattr(err.orig, "pgcode", None) not in REFERENCED_BY_CHILD_ROW:
            raise
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This category still has transactions. Reassign or delete them first.",
        )

    return None