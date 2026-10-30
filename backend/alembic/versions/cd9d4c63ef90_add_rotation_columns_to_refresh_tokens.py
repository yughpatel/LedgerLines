"""add rotation columns to refresh_tokens

Revision ID: cd9d4c63ef90
Revises: e3a9c7d51b28
Create Date: 2026-10-31 16:17:39.079740

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd9d4c63ef90'
down_revision: Union[str, Sequence[str], None] = 'e3a9c7d51b28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = 'fk_refresh_tokens_replaced_by_id'

def upgrade() -> None:
    """Upgrade schema."""
    # Both nullable: existing rows were never rotated, so there's nothing to backfill
    op.add_column('refresh_tokens', sa.Column(
        'replaced_at', sa.DateTime(timezone=True),
        nullable=True))

    op.add_column("refresh_tokens", sa.Column(
        "replaced_by_id", sa.Integer(), nullable=True))

    # Points at another row in the same table. SET NULL so deleting an old
    # replacement row doesn't fail on the rows that still point to it

    op.create_foreign_key(
        FK_NAME,
        'refresh_tokens', 'refresh_tokens',
        ['replaced_by_id'], ['id'],
        ondelete='SET NULL'
    )



def downgrade() -> None:
    """Downgrade schema."""
    # The constraint depends on the column, so it goes first
    op.drop_constraint(FK_NAME, 'refresh_tokens', type_="foreignkey")
    op.drop_column('refresh_tokens', 'replaced_by_id')
    op.drop_column('refresh_tokens', 'replaced_at')
