from typing import TYPE_CHECKING, Optional, List
from app import Base
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Index, func, column

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.transaction import Transaction


class Category(Base):
    __tablename__ = 'categories'

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    # NULL = system default category, a value = that user's custom category
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    # Bidirectional relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="categories")
    transactions: Mapped[List["Transaction"]] = relationship("Transaction", back_populates="category")

    __table_args__ = (
        Index(
            'ix_categories_user_id_name_lower',
            'user_id',
            func.lower(column('name')),
            unique=True,
            postgresql_nulls_not_distinct=True
        ),
    )