"""add refund to transactiontype

Revision ID: c5d82e7a41f3
Revises: a7c3e1f92b04
Create Date: 2026-10-06 15:02:31.418207

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c5d82e7a41f3'
down_revision: Union[str, Sequence[str], None] = 'a7c3e1f92b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # A new enum value can't be used until the transaction that added it commits,
    # so it gets committed on its own instead of inside Alembic's migration transaction
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'REFUND'")


def downgrade() -> None:
    """Downgrade schema."""
    # Refunds were recorded as CREDIT before this type existed, so that's where they go back to
    op.execute("UPDATE transactions SET type = 'CREDIT' WHERE type = 'REFUND'")
    # Postgres can't drop a single enum value, so the type is rebuilt without it
    op.execute('ALTER TYPE transactiontype RENAME TO transactiontype_old')
    op.execute("CREATE TYPE transactiontype AS ENUM ('CREDIT', 'DEBIT')")
    op.execute('ALTER TABLE transactions ALTER COLUMN type TYPE transactiontype USING type::text::transactiontype')
    op.execute('DROP TYPE transactiontype_old')
