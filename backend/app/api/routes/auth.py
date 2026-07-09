from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserResponse
from app.models.user import User
from app.db.session import get_db
from app.auth.security import hash_password

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