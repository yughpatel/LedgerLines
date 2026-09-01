from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionResponse


def get_user_transactions(current_user_id: int, session: Session) -> list[TransactionResponse]:
    """
    Return the current user's transactions, each tagged with a per-user sequence number.

    seq_number comes from ROW_NUMBER() partitioned by user_id, so it restarts at 1 for
    every user and is never affected by another user's rows. It is ordered by created_at
    with id as the tiebreaker, so two rows inserted in the same tick still get a stable,
    deterministic order.

    The rows themselves are returned newest transaction_date first, matching how the
    list is displayed.
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
        # from_attributes reads the mapped columns straight off the ORM object; seq_number
        # isn't one of them, so it lands as None here and is filled in by the copy below.
        # Copying rather than assigning onto the ORM object keeps the entity unmutated.
        response = TransactionResponse.model_validate(transaction)
        transactions.append(response.model_copy(update={"seq_number": seq_number}))

    return transactions
