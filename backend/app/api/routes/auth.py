from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.db.session import get_db
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    find_refresh_token,
    get_current_user,
    verify_refresh_token
)
from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

# How long a just-rotated refresh token still gets an access token. Covers two tabs
# refreshing at the same moment: they share one cookie, so the slower tab sends the
# token the faster one has just rotated
ROTATION_GRACE = timedelta(seconds=10)


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")  # Target limit for registration
def create_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        # Intentional tradeoff: Email enumeration risk accepted until email infra (SendGrid/SES) is implemented.
        # 409 Conflict provides necessary UX feedback so users aren't stranded in a blind failure loop.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Hash password before storing
    hashed_password = hash_password(user.password)

    # Creating new user instance
    new_user = User(
        email=user.email,
        hashed_password=hashed_password
    )

    # Saving to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def login_user(request: Request, user: UserLogin, response: Response, db: Session = Depends(get_db)):
    # Check if user exists and password is correct
    existing_user = db.query(User).filter(User.email == user.email).first()
    if not existing_user or not verify_password(user.password, existing_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    # Generate tokens
    access_token = create_access_token(data={"sub": str(existing_user.id), "ver": existing_user.token_version})
    refresh_token = create_refresh_token(db=db, user_id=existing_user.id)

    # Determine cookie security based on environment setting
    is_production = settings.environment == "production"

    # Set refresh token as an HTTP-only cookie scoped to /auth
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/auth",
    )

    set_refresh_cookie(response, refresh_token)

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.post("/refresh", response_model=Token, status_code=status.HTTP_200_OK)
def refresh_token_route(
        response: Response,
        db: Session = Depends(get_db),
        refresh_token: str | None = Cookie(default=None)
):
    # Check if the refresh token cookie is present in the request
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )

    # Locked, and returned in any state; see find_refresh_token
    token_row = find_refresh_token(refresh_token, db)
    now = datetime.now(timezone.utc)

    if token_row.revoked:
        # Revoked by logout, not rotation. No mass revoke: anyone holding an old copy
        # of a logged-out cookie could otherwise log the real user out everywhere
        if token_row.replaced_at is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found or revoked")

        if now - token_row.replaced_at < ROTATION_GRACE:
            # Only while the replacement is still active. If the user logged out in
            # those seconds, this old token must not undo the logout
            replacement = db.get(RefreshToken, token_row.replaced_by_id) if token_row.replaced_by_id else None
            if replacement is None or replacement.revoked:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found or revoked")
            user = db.get(User, token_row.user_id)
            if user is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
            # No new refresh token: the cookie already holds the replacement
            return {"access_token": create_access_token(data={"sub": str(user.id), "ver": user.token_version}), "token_type": "bearer"}

        # Rotated long ago and used again, so someone else has a copy. We can't tell
        # which side is the attacker, so every session of this user ends
        db.query(RefreshToken).filter(
            RefreshToken.user_id == token_row.user_id,
            RefreshToken.revoked.is_(False),
        ).update({RefreshToken.revoked: True})
        db.query(User).filter(User.id == token_row.user_id).update({User.token_version: User.token_version + 1})
        # Before the raise: get_db closes the session afterwards, and an uncommitted
        # session is rolled back, which would quietly undo all of the above
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    user = db.get(User, token_row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Rotation: the old row is retired and the new one saved in the same commit
    new_refresh_token = create_refresh_token(db, user.id, replaces=token_row)
    set_refresh_cookie(response, new_refresh_token)

    return {"access_token": create_access_token(data={"sub": str(user.id), "ver": user.token_version}), "token_type": "bearer"}

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout_user(
        response: Response,
        db: Session = Depends(get_db),
        refresh_token: str | None = Cookie(default=None)
):
    # If no refresh token cookie exists, clear the cookie using the exact matching path scope
    if not refresh_token:
        response.delete_cookie(key="refresh_token", path="/auth")
        return {"detail": "Successfully logged out"}

    try:
        user, token_row = verify_refresh_token(refresh_token, db)
        token_row.revoked = True
        # Ends every access token this user holds, on all devices. Other devices still
        # have their refresh tokens, so they get a new access token on their next request.
        # Incremented in SQL so two logouts at once can't both write the same number
        db.query(User).filter(User.id == user.id).update({User.token_version: User.token_version + 1})
        db.commit()
    except HTTPException:
        # Silently pass on invalid tokens during logout
        pass

    # Clear the refresh token cookie from the browser using the exact matching path scope
    response.delete_cookie(
        key="refresh_token",
        path="/auth"
    )

    return {"detail": "Successfully logged out"}

def set_refresh_cookie(response: Response, raw_token: str) -> None:
    # Determine cookie security based on environment setting
    is_production = settings.environment == "production"

    # Set refresh token as an HTTP-only cookie scoped to /auth
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/auth"
    )