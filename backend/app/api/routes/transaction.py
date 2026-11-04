from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.schemas.transaction import TransactionUpdate, TransactionResponse, MonthlySummaryResponse, TransactionCreateRequest
from app.models.transaction import Transaction, TransactionType
from app.db.session import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.services.category import validate_category
from app.services.period import month_range, resolve_month
from app.services.transaction import get_user_transactions
import calendar
from decimal import Decimal
from sqlalchemy import func, select, case

router = APIRouter(prefix="/transactions", tags=["transaction"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=TransactionResponse)
def create_transaction(data: TransactionCreateRequest, session: Session=Depends(get_db),
                       current_user: User=Depends(get_current_user)):
    validate_category(data.category_id, current_user.id, session)

    new_transaction = Transaction(
        user_id = current_user.id,
        amount = data.amount,
        category_id = data.category_id,
        type = data.type,
        description= data.description,
        transaction_date = data.transaction_date
    )

    session.add(new_transaction)
    session.commit()
    session.refresh(new_transaction)
    return new_transaction

@router.get("", status_code=status.HTTP_200_OK, response_model=list[TransactionResponse])
def list_transactions(session: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    return get_user_transactions(current_user.id, session)

@router.get("/summary", status_code=status.HTTP_200_OK, response_model=MonthlySummaryResponse)
def get_monthly_summary(year: Optional[int] = Query(default=None, ge=2020),
                        month: Optional[int] = Query(default=None, ge=1, le=12),
                        session: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    """
    Earned, spent and net for one IST calendar month.
    Defaults to the current month. Pass both year and month, or neither.
    """
    # Both the month and its boundaries are IST, so a transaction at 00:30 IST on
    # the 1st isn't counted in the month before
    year, month = resolve_month(year, month)
    start_of_month, start_of_next_month = month_range(year, month)

    stmt = select(
        func.coalesce(
            func.sum(
                case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)
            ),
            0
        ).label("total_earned"),
        # Refunds are subtracted here rather than added to total_earned; this can go
        # negative when a refund lands in a later month than the purchase, and that's correct
        func.coalesce(
            func.sum(
                case(
                    (Transaction.type == TransactionType.DEBIT, Transaction.amount),
                    (Transaction.type == TransactionType.REFUND, -Transaction.amount),
                    else_=0
                )
            ),
            0
        ).label("total_spent")
    ).where(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_of_month,
        Transaction.transaction_date < start_of_next_month
    )
    row = session.execute(stmt).fetchone()

    total_earned = row.total_earned
    total_spent = row.total_spent
    net_balance = total_earned - total_spent

    return {
        # Sent so the frontend labels the card with the month these totals cover,
        # instead of working it out in the browser's own timezone
        "year": year,
        "month": month,
        "total_earned": total_earned,
        "total_spent": total_spent,
        "net": net_balance
    }

@router.get("/{id}", status_code=status.HTTP_200_OK, response_model=TransactionResponse)
def get_transaction(id: int, session: Session=Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/{id}", status_code=status.HTTP_200_OK, response_model=TransactionResponse)
def update_transaction(id: int, data: TransactionUpdate, session: Session=Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = data.model_dump(exclude_unset=True)

    # Protect against malicious mass-assignment tampering
    update_data.pop("user_id", None)
    update_data.pop("id", None)

    if "category_id" in update_data:
        validate_category(update_data["category_id"], current_user.id, session)

    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(id: int, session: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    session.delete(transaction)
    session.commit()
    return None