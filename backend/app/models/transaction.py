from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import Base
from decimal import Decimal
from typing import Optional
from datetime import datetime
from sqlalchemy import Enum as SqlEnum, func, Numeric, ForeignKey, DateTime
from enum import Enum

class TransactionType(str, Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"

class Transaction(Base):
    __tablename__ = 'transactions'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Links each transaction to its owner in the users table
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    user: Mapped["User"] = relationship("User")

    # timezone=True avoids ambiguity if server/user timezones differ.
    # server_default uses Postgres's own clock, not Python's, so it's consistent even across multiple app servers
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Enum restricts this to only CREDIT/DEBIT at the database level,
    # so invalid values can't slip in even from outside this app
    type: Mapped[TransactionType] = mapped_column(SqlEnum(TransactionType))

    # float is not precise, Decimal provides the precision
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=10, scale=2))

    category: Mapped[str]

    # Optional in Python and nullable=True in the DB agree:
    # a transaction can be saved without a description
    description: Mapped[Optional[str]] = mapped_column(nullable=True)