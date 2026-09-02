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

# Postgres SQLSTATEs meaning "a child row still references this". Which one you get
# depends on how the FK is declared: RESTRICT raises 23001, a plain NO ACTION FK raises
# 23503. Both are accepted so the handler survives the constraint being redeclared.
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
    Delete one of the user's own categories.

    Rejects with 409 if any transaction still references it. The check is the DB's
    RESTRICT rather than a pre-count, so a transaction created between the check and
    the delete can't slip through the gap.
    """
    category = get_owned_category(id, current_user.id, session)

    session.delete(category)
    try:
        session.commit()
    except IntegrityError as err:
        # A failed flush leaves the session aborted — every later statement errors
        # until it is rolled back, including anything a later dependency runs.
        session.rollback()
        # Only a child-row reference means "still in use". Anything else is a genuine
        # fault and must surface as a 500 instead of a misleading "in use" message.
        if getattr(err.orig, "pgcode", None) not in REFERENCED_BY_CHILD_ROW:
            raise
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This category still has transactions. Reassign or delete them first.",
        )

    return None