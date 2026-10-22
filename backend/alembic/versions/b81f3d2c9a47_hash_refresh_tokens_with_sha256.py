"""hash refresh tokens with sha256

Revision ID: b81f3d2c9a47
Revises: c5d82e7a41f3
Create Date: 2026-10-22 15:41:08.334901

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b81f3d2c9a47'
down_revision: Union[str, Sequence[str], None] = 'c5d82e7a41f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = 'ix_refresh_tokens_token_hash'


def upgrade() -> None:
    """Upgrade schema."""
    # Old bcrypt hashes can never match a SHA-256 lookup, so these rows are dead either
    # way. Deleted first, before the type change and unique index touch them. Every
    # user has to log in again once
    op.execute('DELETE FROM refresh_tokens')
    op.alter_column(
        'refresh_tokens', 'token_hash',
        type_=sa.String(length=64), existing_type=sa.String(), existing_nullable=False,
    )
    op.drop_index(INDEX_NAME, table_name='refresh_tokens')
    op.create_index(INDEX_NAME, 'refresh_tokens', ['token_hash'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    # SHA-256 rows can't be verified by the old bcrypt code either, so they go too
    op.execute('DELETE FROM refresh_tokens')
    op.drop_index(INDEX_NAME, table_name='refresh_tokens')
    # Restores exactly what 216f1ef64717 created: plain String(), non-unique index, same name
    op.create_index(INDEX_NAME, 'refresh_tokens', ['token_hash'], unique=False)
    op.alter_column(
        'refresh_tokens', 'token_hash',
        type_=sa.String(), existing_type=sa.String(length=64), existing_nullable=False,
    )
