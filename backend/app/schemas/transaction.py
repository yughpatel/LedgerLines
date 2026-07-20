from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
# Single source of truth: imported from models to prevent code drift if a new type (like TRANSFER) is added later
from app.models.transaction import TransactionType

class CategoryResponse(BaseModel):
    id: int
    name: str

    # To allow direct parsing from database ORM objects
    model_config = ConfigDict(from_attributes=True)


# No id field here: the database assigns the ID via autoincrement=True at insert time; the client never sends one
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Decimal
    # Replaces legacy 'category: str' with deterministic input id
    category_id: int
    description: Optional[str] = None
    transaction_date: datetime


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


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[Decimal] = None
    # Optional wrapper allows partial updates without forcing category changes
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None

class MonthlySummaryResponse(BaseModel):
    total_earned: Decimal
    total_spent: Decimal
    net: Decimal
