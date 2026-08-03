from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import Base
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Enum as SqlEnum, Numeric, ForeignKey, DateTime
from enum import Enum
from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.category import Category

class TransactionType(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"

# ==============================================================================
# Database Model
# ==============================================================================

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

# ==============================================================================
# Validation Schemas
# ==============================================================================

class TransactionCreateRequest(BaseModel):
    # Core transaction details
    transaction_date: datetime
    type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=10)

    # Foreign key to category (ondelete removed)
    category_id: int

    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_strict_scale(cls, value: Decimal) -> Decimal:
        # Prevent silent rounding by verifying no fractional remainder exists past 2 decimal places
        if (value * 100) % 1 != 0:
            raise ValueError("Amount cannot have more than 2 decimal places.")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            stripped = value.strip()
            if not stripped:
                raise ValueError("Description cannot be empty or just whitespace.")
            return stripped
        return value