from app import Base
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)

    # Unique so we can look up exactly one user by email at login
    email: Mapped[str] = mapped_column(String(255), unique=True)

    # Storing the hash, never the plain password (see security.py).
    # Named "hashed_password" so it's obvious this is never raw.
    hashed_password: Mapped[str] = mapped_column(String(255))
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user")
    categories: Mapped[list["Category"]] = relationship("Category", back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="user",
                                                                cascade="all, delete-orphan")