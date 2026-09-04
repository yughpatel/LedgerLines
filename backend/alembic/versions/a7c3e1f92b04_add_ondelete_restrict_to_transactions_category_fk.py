"""add ondelete restrict to transactions category fk

Revision ID: a7c3e1f92b04
Revises: 6b4b64025ab1
Create Date: 2026-09-02 11:14:07.812390

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a7c3e1f92b04'
down_revision: Union[str, Sequence[str], None] = '6b4b64025ab1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT_NAME = 'fk_transactions_category_id'


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres can't ALTER a referential action, so drop and recreate under the same name
    op.drop_constraint(CONSTRAINT_NAME, 'transactions', type_='foreignkey')
    op.create_foreign_key(
        CONSTRAINT_NAME,
        'transactions',
        'categories',
        ['category_id'],
        ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(CONSTRAINT_NAME, 'transactions', type_='foreignkey')
    op.create_foreign_key(
        CONSTRAINT_NAME,
        'transactions',
        'categories',
        ['category_id'],
        ['id'],
    )
