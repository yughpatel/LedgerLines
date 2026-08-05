from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.models.user import User
from app.db.session import get_db
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_refresh_token
)
from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")  # Target limit for registration
async def create_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
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
async def login_user(request: Request, user: UserLogin, response: Response, db: Session = Depends(get_db)):
    # Check if user exists and password is correct
    existing_user = db.query(User).filter(User.email == user.email).first()
    if not existing_user or not verify_password(user.password, existing_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    # Generate tokens
    access_token = create_access_token(data={"sub": str(existing_user.id)})
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
        path="/auth"
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.post("/refresh", response_model=Token, status_code=status.HTTP_200_OK)
async def refresh_token_route(
        db: Session = Depends(get_db),
        refresh_token: str | None = Cookie(default=None)
):
    # Check if the refresh token cookie is present in the request
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )

    # Validate the token using the correct argument position
    user, _ = verify_refresh_token(refresh_token, db)

    # Generate a brand new access token for the authenticated user
    new_access_token = create_access_token(data={"sub": str(user.id)})

    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(
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