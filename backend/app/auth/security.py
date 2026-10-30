import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
# Use bcrypt to resist brute-force and GPU-accelerated cracking attacks.
# Same algorithm passlib used, so existing hashes still verify
pwd_context = PasswordHash((BcryptHasher(),))
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
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt
def hash_refresh_token(raw_token: str) -> str:
    """
    SHA-256 hex digest of a refresh token, which is what the database stores.

    Not bcrypt: a refresh token is long and random, so slow hashing adds nothing, and
    bcrypt only reads the first 72 bytes, which for these JWTs is mostly the same
    header and user id. A plain digest covers the whole token and can be looked up
    directly by index.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_refresh_token(db: Session, user_id: int, replaces: RefreshToken | None = None) -> str:
    """
    Generates a raw JWT refresh token, hashes it, saves the hash
    to the database, and returns the unhashed raw token string.

    With `replaces`, this is a rotation: the new token keeps the old one's expiry,
    so a session still ends a fixed time after login, and the old row is retired
    in the same commit, so there is never a moment with both or neither active.
    """
    # Note: Explicitly using UTC timezone ensures consistency across servers
    now = datetime.now(timezone.utc)
    if replaces is not None:
        expires_at = replaces.expires_at
    else:
        expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "type": "refresh",  # Explicitly label token type to prevent mix-ups with access tokens
        # exp only has whole seconds, so without this two logins in the same second would
        # produce identical tokens and collide on the unique token_hash index.
        # uuid4 comes from the OS's secure random source
        "jti": uuid.uuid4().hex,
    }
    raw_refresh_token = jwt.encode(payload, settings.refresh_token_secret_key, algorithm=settings.algorithm)
    db_refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=expires_at
    )
    db.add(db_refresh_token)

    if replaces is not None:
        # flush sends the INSERT now, without committing, so the new row has an id to point at
        db.flush()
        replaces.revoked = True
        replaces.replaced_at = now
        replaces.replaced_by_id = db_refresh_token.id

    db.commit()
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
        token_version = payload.get("ver")
        # If "sub" field is missing, the token is malformed
        if user_id is None or token_type == "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    current_user = db.query(User).filter(User.id == int(user_id)).first()
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    # Issued before the user's last logout, or before versions existed (no "ver" at all)
    if token_version != current_user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    return current_user

def find_refresh_token(raw_token: str, db: Session) -> RefreshToken:
    """
    Decodes the raw refresh token and returns its database row, locked, in any state:
    active, rotated or revoked. The caller decides what that state means.

    Raises 401 only when the token can't be ours at all: bad signature, expired,
    wrong type, or no matching row.
    """
    # Decode and validate the JWT signature and basic constraints
    try:
        payload = jwt.decode(
            raw_token,
            settings.refresh_token_secret_key,
            algorithms=[settings.algorithm]
        )
    except jwt.InvalidTokenError:
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

    # No revoked filter, on purpose. A request that waits on this lock re-checks its
    # WHERE clause against the row as the other request left it, so "revoked is false"
    # here would make a rotated token look like an unknown one and skip the grace path.
    # The lock makes two refreshes of the same token take turns instead of both rotating it
    matched_token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == hash_refresh_token(raw_token),
            RefreshToken.user_id == int(user_id),
        )
        .with_for_update()
        .first()
    )

    if not matched_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )

    # The JWT 'exp' claim is validated during jwt.decode() automatically.
    # Checking row.expires_at as well lets an admin shorten a session in the database
    if matched_token_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired in database records",
        )

    return matched_token_record


def verify_refresh_token(raw_token: str, db: Session) -> tuple[User, RefreshToken]:
    """
    Returns the User and RefreshToken row for an active refresh token, or raises 401.
    Rotated and revoked tokens are both rejected here; only /auth/refresh needs to tell them apart.
    """
    matched_token_record = find_refresh_token(raw_token, db)

    if matched_token_record.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )

    # Fetch and return the authenticated user object
    user = db.query(User).filter(User.id == matched_token_record.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return user, matched_token_record