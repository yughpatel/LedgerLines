from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.transaction import TransactionType
from app.schemas.category import CategoryResponse

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    type: TransactionType
    amount: Decimal
    # Nested Object: Returns full dictionary to frontend for UI rendering & data filtering
    category: CategoryResponse
    description: Optional[str] = None
    transaction_date: datetime

    # To allow direct parsing from database ORM objects
    model_config = ConfigDict(from_attributes=True)


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


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    # If provided, the amount must be greater than 0 and fit within structural constraints
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=10)
    # Optional wrapper allows partial updates without forcing category changes
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None

    @field_validator("amount")
    @classmethod
    def validate_strict_scale(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is not None:
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


class MonthlySummaryResponse(BaseModel):
    total_earned: Decimal
    total_spent: Decimal
    net: Decimal