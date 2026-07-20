"""add category table and migrate data

Revision ID: 26315f1d6b84
Revises: 978cf29d1766
Create Date: 2026-07-20 23:26:49.593673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '26315f1d6b84'
down_revision: Union[str, Sequence[str], None] = '978cf29d1766'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
        """Upgrade schema."""
        op.create_table(
            'categories',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
            sa.UniqueConstraint('user_id', 'name', name='uix_user_category_name')
        )

        categories_table = sa.table(
            'categories',
            sa.column('id', sa.Integer),
            sa.column('name', sa.String),
            sa.column('user_id', sa.Integer)
        )
        transactions_table = sa.table(
            'transactions',
            sa.column('id', sa.Integer),
            sa.column('category', sa.String),
            sa.column('category_id', sa.Integer),
            sa.column('user_id', sa.Integer)
        )

        system_defaults = ["Food", "Rent", "Travel", "Utilities", "Other"]
        op.bulk_insert(
            categories_table,
            [{"name": name, "user_id": None} for name in system_defaults]
        )

        op.add_column('transactions', sa.Column('category_id', sa.Integer(), nullable=True))

        connection = op.get_bind()

        defaults_query = sa.select(categories_table.c.id, categories_table.c.name).where(
            categories_table.c.user_id.is_(None))
        default_rows = connection.execute(defaults_query).fetchall()

        category_map = {row.name.lower().strip(): row.id for row in default_rows}
        other_category_id = category_map["other"]

        tx_query = sa.select(transactions_table.c.category, transactions_table.c.user_id).distinct()
        existing_strings = connection.execute(tx_query).fetchall()

        for old_string, tx_user_id in existing_strings:
            if old_string is None or not old_string.strip():
                update_stmt = transactions_table.update().where(
                    transactions_table.c.category.is_(None) if old_string is None else transactions_table.c.category == old_string,
                    transactions_table.c.user_id == tx_user_id
                ).values(category_id=other_category_id)
                connection.execute(update_stmt)
                continue

            normalized_str = old_string.lower().strip()

            # Case 1: Matches a system default
            if normalized_str in category_map:
                target_id = category_map[normalized_str]

            # Case 2: Custom user category
            else:
                display_name = old_string.strip().title()

                check_custom = sa.select(categories_table.c.id).where(
                    categories_table.c.name == display_name,
                    categories_table.c.user_id == tx_user_id
                )
                existing_custom = connection.execute(check_custom).scalar()

                if existing_custom:
                    target_id = existing_custom
                else:
                    # FIX: Append .returning() clause to explicitly capture Postgres auto-generated sequence IDs
                    insert_stmt = categories_table.insert().values(
                        name=display_name,
                        user_id=tx_user_id
                    ).returning(categories_table.c.id)
                    target_id = connection.execute(insert_stmt).scalar()

            update_stmt = transactions_table.update().where(
                transactions_table.c.category == old_string,
                transactions_table.c.user_id == tx_user_id
            ).values(category_id=target_id)
            connection.execute(update_stmt)

        op.alter_column('transactions', 'category_id', nullable=False)
        op.create_foreign_key('fk_transactions_category_id', 'transactions', 'categories', ['category_id'], ['id'])
        op.drop_column('transactions', 'category')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('transactions', sa.Column('category', sa.String(), nullable=True))

    categories_table = sa.table(
        'categories',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String)
    )
    transactions_table = sa.table(
        'transactions',
        sa.column('category', sa.String),
        sa.column('category_id', sa.Integer)
    )

    connection = op.get_bind()
    cat_query = sa.select(categories_table.c.id, categories_table.c.name)
    categories = connection.execute(cat_query).fetchall()

    for cat_id, cat_name in categories:
        update_stmt = transactions_table.update().where(
            transactions_table.c.category_id == cat_id
        ).values(category=cat_name)
        connection.execute(update_stmt)

    op.drop_constraint('fk_transactions_category_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'category_id')
    op.drop_table('categories')
