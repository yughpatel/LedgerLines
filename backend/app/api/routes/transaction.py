from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.transaction import TransactionUpdate, TransactionResponse, MonthlySummaryResponse, TransactionCreateRequest
from app.models.transaction import Transaction, TransactionType
from app.db.session import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.services.category import validate_category
import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import func, select, case

router = APIRouter(prefix="/transactions", tags=["transaction"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=TransactionResponse)
async def create_transaction(data: TransactionCreateRequest, session: Session=Depends(get_db),
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
async def list_transactions(session: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    transactions = session.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.transaction_date.desc()).all()
    return transactions

@router.get("/summary", status_code=status.HTTP_200_OK, response_model=MonthlySummaryResponse)
def get_monthly_summary(session: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    today = date.today()

    # Establish strict timezone-aware boundaries using a half-open interval
    start_of_month = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
    if today.month == 12:
        start_of_next_month = datetime(today.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        start_of_next_month = datetime(today.year, today.month + 1, 1, tzinfo=timezone.utc)

    stmt = select(
        func.coalesce(
            func.sum(
                case((Transaction.type == TransactionType.CREDIT, Transaction.amount), else_=0)
            ),
            0
        ).label("total_earned"),
        func.coalesce(
            func.sum(
                case((Transaction.type == TransactionType.DEBIT, Transaction.amount), else_=0)
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
        "total_earned": total_earned,
        "total_spent": total_spent,
        "net": net_balance
    }

@router.get("/{id}", status_code=status.HTTP_200_OK, response_model=TransactionResponse)
async def get_transaction(id: int, session: Session=Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/{id}", status_code=status.HTTP_200_OK, response_model=TransactionResponse)
async def update_transaction(id: int, data: TransactionUpdate, session: Session=Depends(get_db),
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
async def delete_transaction(id: int, session: Session = Depends(get_db),
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