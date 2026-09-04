from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionResponse


def get_user_transactions(current_user_id: int, session: Session) -> list[TransactionResponse]:
    """
    Return the user's transactions, each tagged with a per-user sequence number.

    seq_number is ROW_NUMBER() partitioned by user_id, so it restarts at 1 per user.
    Ordered by created_at with id as tiebreaker; rows come back newest-date first.
    """
    stmt = (
        select(
            Transaction,
            func.row_number()
            .over(
                partition_by=Transaction.user_id,
                order_by=(Transaction.created_at, Transaction.id),
            )
            .label("seq_number"),
        )
        .where(Transaction.user_id == current_user_id)
        .order_by(Transaction.transaction_date.desc())
    )

    transactions = []
    for transaction, seq_number in session.execute(stmt):
        # seq_number isn't a mapped column so it validates as None; copying fills it in
        # without mutating the ORM object
        response = TransactionResponse.model_validate(transaction)
        transactions.append(response.model_copy(update={"seq_number": seq_number}))

    return transactions
