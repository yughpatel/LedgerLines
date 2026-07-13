from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.core.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User

# Use bcrypt to resist brute-force and GPU-accelerated cracking attacks.
# 'deprecated="auto" flag marks outdated hashes for automatic updating in case of changing algorithms.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Hash the plain password again and compare to the stored hash. We never decrypt (hashing only works one way).
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """
     Create a JWT token containing user data.
     data: dict with user info, typically {"sub": str(user.id)}
     expires_delta: optional custom expiration time; if None, uses settings.ACCESS_TOKEN_EXPIRE_MINUTES
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta

    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(HTTPBearer()), db: Session = Depends(get_db)):
    """Extract and validate JWT token from the Authorization header.
    Returns the user ID if token is valid. Raises 401 if token is invalid, missing or expired."""

    try:
        # Decoding the JWT using SECRET_KEY and ALGORITHM, To verify the signature and check expiration
        payload = jwt.decode(token.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Extract User ID from the payload
        user_id: str = payload.get("sub")

        # If "sub" field is missing, the token is malformed
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    current_user = db.query(User).filter(User.id == int(user_id)).first()
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return current_user