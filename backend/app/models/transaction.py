from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import Base
from decimal import Decimal
from typing import Optional
from datetime import datetime
from sqlalchemy import Enum as SqlEnum, func, Numeric, ForeignKey
from enum import Enum

class TransactionType(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"

class Transaction(Base):
    __tablename__ = 'transactions'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship("User")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    type: Mapped[TransactionType] = mapped_column(SqlEnum(TransactionType))
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=10, scale=2))
    category: Mapped[str]
    description: Mapped[Optional[str]] = mapped_column(nullable=True)`