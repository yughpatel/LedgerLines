"""feat: add transactions table

Revision ID: 978cf29d1766
Revises: f4e91870f4ef
Create Date: 2026-07-14 07:00:05.176030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '978cf29d1766'
down_revision: Union[str, Sequence[str], None] = 'f4e91870f4ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Added nullable first — an existing row has nothing to put in a NOT NULL column
    # with no default, so adding it constrained outright fails on a populated table
    op.add_column('transactions', sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=True))
    # created_at is the only per-row timestamp we have, and it is dropped below,
    # so the backfill has to happen while it still exists
    op.execute('UPDATE transactions SET transaction_date = created_at WHERE transaction_date IS NULL')
    op.alter_column('transactions', 'transaction_date', nullable=False)
    op.drop_column('transactions', 'created_at')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('transactions', sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False))
    # Mirror of the upgrade backfill: keep each row's own timestamp instead of letting
    # the default stamp every row with the rollback time. The original created_at was
    # destroyed by upgrade() and can't be recovered
    op.execute('UPDATE transactions SET created_at = transaction_date')
    op.drop_column('transactions', 'transaction_date')
