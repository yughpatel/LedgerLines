from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import Base
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Enum as SqlEnum, Numeric, ForeignKey, DateTime
from enum import Enum
if TYPE_CHECKING:
    from app.models.user import User
    from app.models.category import Category
class TransactionType(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"
class Transaction(Base):
    __tablename__ = 'transactions'
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Links each transaction to its owner
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    # Core transaction details
    transaction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    type: Mapped[TransactionType] = mapped_column(SqlEnum(TransactionType))
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=10, scale=2))
    # Foreign key to category (ondelete removed)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    category: Mapped["Category"] = relationship("Category", back_populates="transactions")
    description: Mapped[Optional[str]] = mapped_column(nullable=True)