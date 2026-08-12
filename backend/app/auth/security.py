from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
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
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt
def create_refresh_token(db: Session, user_id: int) -> str:
    """
    Generates a raw JWT refresh token, hashes it, saves the hash
    to the database, and returns the unhashed raw token string.
    """
    # Build the JWT payload
    # Note: Explicitly using UTC timezone ensures consistency across servers
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "type": "refresh"  # Explicitly label token type to prevent mix-ups with access tokens
    }
    # Encode into a raw JWT string
    raw_refresh_token = jwt.encode(payload, settings.refresh_token_secret_key, algorithm=settings.algorithm)
    # Hash that raw string
    token_hash = pwd_context.hash(raw_refresh_token)
    # Save a new row to the refresh_tokens table
    db_refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    db.commit()
    # Return the raw, unhashed JWT string
    return raw_refresh_token
def get_current_user(token: str = Depends(HTTPBearer()), db: Session = Depends(get_db)):
    """Extract and validate JWT token from the Authorization header.
    Returns the user ID if token is valid. Raises 401 if token is invalid, missing or expired."""
    try:
        # Decoding the JWT using secret_key and algorithm, To verify the signature and check expiration
        payload = jwt.decode(token.credentials, settings.secret_key, algorithms=[settings.algorithm])
        # Extract User ID from the payload
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        # If "sub" field is missing, the token is malformed
        if user_id is None or token_type == "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    current_user = db.query(User).filter(User.id == int(user_id)).first()
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return current_user

def verify_refresh_token(raw_token: str, db: Session = Depends(get_db)) -> tuple[User, RefreshToken]:
    """
    Decodes the raw refresh token, validates its integrity,
    verifies it against active database hashes, and returns the User and RefreshToken record.
    """
    # Decode and validate the JWT signature and basic constraints
    try:
        payload = jwt.decode(
            raw_token,
            settings.refresh_token_secret_key,
            algorithms=[settings.algorithm]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract and validate payload claims
    user_id = payload.get("sub")
    token_type = payload.get("type")

    if not user_id or token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload claims",
        )

    # Query active, unrevoked database tokens for this user
    active_tokens = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == int(user_id), RefreshToken.revoked == False)
        .all()
    )

    # Linearly verify the raw string against stored database hashes
    matched_token_record = None
    for row in active_tokens:
        if pwd_context.verify(raw_token, row.token_hash):
            matched_token_record = row
            break

    if not matched_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )

    # DB-Level Expiration Check Analysis
    # The JWT 'exp' claim is validated during jwt.decode() automatically.
    # Checking row.expires_at against datetime.now(timezone.utc) catches:
    # - Administrative updates where an admin manually shortens validity in the DB.
    # - Changes to token lifespan settings that are retroactively enforced via DB updates.
    if matched_token_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired in database records",
        )

    # Fetch and return the authenticated user object
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this token no longer exists",
        )

    # Return both the User and the matched DB record row
    return user, matched_token_record
