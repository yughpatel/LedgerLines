from pydantic import BaseModel, ConfigDict
from enum import Enum
from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    model_config = ConfigDict(from_attributes=True)

class TransactionType(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"

class TransactionCreate(BaseModel):
    transaction_type: TransactionType
    amount: float
    category: str
    description: Optional[str] = None

class TransactionResponse(BaseModel):
    id: int
    transaction_type: TransactionType
    amount: float
    category: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)