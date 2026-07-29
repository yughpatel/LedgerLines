from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.models.user import User
from app.db.session import get_db
from app.auth.security import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user, verify_refresh_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Hash password before storing
    hashed_password = hash_password(user.password)

    # Creating new user instance
    new_user = User(
        email = user.email,
        hashed_password = hashed_password
    )

    # Saving to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login_user(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    # Check if user exists and password is correct
    existing_user = db.query(User).filter(User.email == user.email).first()
    if not existing_user or not verify_password(user.password, existing_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    # Generate tokens
    access_token = create_access_token(data={"sub": str(existing_user.id)})
    refresh_token = create_refresh_token(db=db, user_id=existing_user.id)

    # Determine cookie security based on environment setting
    is_production = settings.environment == "production"

    # Set refresh token as an HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,  # Fixed lowercase case-sensitivity bug
        path="/auth/refresh"
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
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

    # Validate the token using the correct argument position (raw_token first, db second)
    # This will internally raise an HTTPException if validation or user lookup fails
    user = verify_refresh_token(refresh_token, db)

    # Generate a brand new access token for the authenticated user
    new_access_token = create_access_token(data={"sub": str(user.id)})

    return {"access_token": new_access_token, "token_type": "bearer"}
