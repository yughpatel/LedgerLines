"""add token_version to users

Revision ID: e3a9c7d51b28
Revises: b81f3d2c9a47
Create Date: 2026-10-29 21:04:12.118530

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3a9c7d51b28'
down_revision: Union[str, Sequence[str], None] = 'b81f3d2c9a47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default fills existing rows, so NOT NULL needs no separate backfill
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'token_version')
