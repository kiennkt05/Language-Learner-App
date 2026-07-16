"""add target_language to vocab_lists

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vocab_lists', sa.Column('target_language', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('vocab_lists', 'target_language')
