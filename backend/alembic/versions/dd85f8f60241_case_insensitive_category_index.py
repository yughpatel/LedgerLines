"""case insensitive category index

Revision ID: dd85f8f60241
Revises: 216f1ef64717
Create Date: 2026-08-04 16:45:59.268224

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd85f8f60241'
down_revision: Union[str, Sequence[str], None] = '216f1ef64717'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('uix_user_category_name', 'categories', type_='unique')
    op.create_index(
        'ix_categories_user_id_name_lower',
        'categories',
        ['user_id', sa.func.lower(sa.column('name'))],
        unique=True,
        postgresql_nulls_not_distinct=True
    )

def downgrade() -> None:
    op.drop_index('ix_categories_user_id_name_lower', table_name='categories')
    op.create_unique_constraint(
        'uix_user_category_name',
        'categories',
        ['user_id', 'name']
    )