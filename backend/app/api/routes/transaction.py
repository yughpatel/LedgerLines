from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse
from app.models.transaction import Transaction
from app.db.session import get_db
from app.auth.security import get_current_user
from app.models.user import User

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