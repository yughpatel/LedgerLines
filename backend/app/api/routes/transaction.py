from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, MonthlySummaryResponse
from app.models.transaction import Transaction, TransactionType
from app.db.session import get_db
from app.auth.security import get_current_user
from app.models.user import User
import calendar
from datetime import date
from decimal import Decimal
from sqlalchemy import func, select, case
router = APIRouter(prefix="/transactions", tags=["transaction"])

@router.post("", status_code=201, response_model=TransactionResponse)
async def create_transaction(data: TransactionCreate, session: Session=Depends(get_db),
                             current_user: User=Depends(get_current_user)):
    new_transaction = Transaction(
        user_id = current_user.id,
        amount = data.amount,
        category = data.category,
        type = data.type,
        description= data.description,
        transaction_date = data.transaction_date
    )

    session.add(new_transaction)
    session.commit()
    session.refresh(new_transaction)
    return new_transaction

@router.get("", status_code=200, response_model=list[TransactionResponse])
async def list_transactions(session: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    transactions = session.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    return transactions

@router.get("/summary", status_code=200, response_model=MonthlySummaryResponse)
def get_monthly_summary(session: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
        today = date.today()
        first_day_of_month = date(today.year, today.month, 1)
        _, days_in_month = calendar.monthrange(today.year, today.month)
        last_day_of_month = date(today.year, today.month, days_in_month)
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
            Transaction.transaction_date >= first_day_of_month,
            Transaction.transaction_date <= last_day_of_month
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

@router.get("/{id}", status_code=200 , response_model=TransactionResponse)
async def get_transaction(id: int, session: Session=Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/{id}", status_code=200, response_model=TransactionResponse)
async def update_transaction(id: int, data: TransactionUpdate, session: Session=Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    transaction = session.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Exclude unset values so we only update the fields sent by the user
    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(transaction, key, value)

    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

@router.delete("/{id}", status_code=204)
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