    from fastapi import APIRouter, Depends, HTTPException, status
    from sqlalchemy.orm import Session
    from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
    from app.models.user import User
    from app.db.session import get_db
    from app.auth.security import hash_password, verify_password, create_access_token

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
    async def login_user(user: UserLogin, db: Session = Depends(get_db)):
        existing_user = db.query(User).filter(User.email == user.email).first()
        if not existing_user or not verify_password(user.password, existing_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

        access_token = create_access_token(data={"sub": str(existing_user.id)})
        return {"access_token": access_token, "token_type": "bearer"}