from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.transaction import TransactionType

class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Decimal
    category: str
    description: Optional[str] = None

class TransactionResponse(BaseModel):
    id: int
    type: TransactionType
    amount: Decimal
    category: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)