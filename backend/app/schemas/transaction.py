from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.transaction import TransactionType
from app.schemas.category import CategoryResponse

# Product doesn't support backfilling history earlier than this
LOWEST_ALLOWED_TRANSACTION_DATE = datetime(2020, 1, 1, tzinfo=timezone.utc)

# Product cap — no single transaction can exceed ₹5,00,000
MAX_TRANSACTION_AMOUNT = Decimal("500000")


def validate_transaction_date(value: datetime) -> datetime:
    # Reject naive datetimes so timezone semantics are unambiguous at storage
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError("transaction_date must include a timezone offset (e.g. 'Z' or '+05:30').")

    # Reject anything before 2020 — product doesn't support backfilling that far
    if value < LOWEST_ALLOWED_TRANSACTION_DATE:
        raise ValueError("transaction_date cannot be earlier than 2020-01-01.")

    # Reject future-dated transactions until recurring transactions ship;
    # small tolerance for user-clock skew so a slightly-fast laptop doesn't 422 legitimate "now" entries
    now = datetime.now(timezone.utc)
    if value > now + timedelta(minutes=1):
        raise ValueError("transaction_date cannot be in the future; future-dated transactions are not allowed yet.")

    return value


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
    amount: Decimal = Field(gt=0, le=MAX_TRANSACTION_AMOUNT, max_digits=10)

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

    @field_validator("transaction_date")
    @classmethod
    def validate_date(cls, value: datetime) -> datetime:
        return validate_transaction_date(value)


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    # If provided, the amount must be greater than 0 and fit within structural constraints
    amount: Optional[Decimal] = Field(default=None, gt=0, le=MAX_TRANSACTION_AMOUNT, max_digits=10)
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

    @field_validator("transaction_date")
    @classmethod
    def validate_date(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None:
            return validate_transaction_date(value)
        return value


class MonthlySummaryResponse(BaseModel):
    total_earned: Decimal
    total_spent: Decimal
    net: Decimal