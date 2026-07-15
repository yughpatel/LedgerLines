from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
# Single source of truth: imported from models to prevent code drift if a new type (like TRANSFER) is added later
from app.models.transaction import TransactionType


# No id field here: the database assigns the ID via autoincrement=True at insert time; the client never sends one
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Decimal
    category: str
    description: Optional[str] = None
    transaction_date: datetime


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    type: TransactionType
    amount: Decimal
    category: str
    description: Optional[str] = None
    transaction_date: datetime

    # To allow direct parsing from database ORM objects
    model_config = ConfigDict(from_attributes=True)


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None