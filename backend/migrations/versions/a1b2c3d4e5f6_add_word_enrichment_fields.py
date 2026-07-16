"""add word enrichment fields

Revision ID: a1b2c3d4e5f6
Revises: e3a510c49db4
Create Date: 2026-06-24 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e3a510c49db4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('words', sa.Column('pronunciation', sa.String(255), nullable=True))
    op.add_column('words', sa.Column('part_of_speech', sa.String(50), nullable=True))
    op.add_column('words', sa.Column('collocation', sa.String(), nullable=True))
    op.add_column('words', sa.Column('visual_clue', sa.String(), nullable=True))
    op.add_column('words', sa.Column('exercise_level', sa.SmallInteger(), nullable=True, server_default='1'))


def downgrade() -> None:
    op.drop_column('words', 'exercise_level')
    op.drop_column('words', 'visual_clue')
    op.drop_column('words', 'collocation')
    op.drop_column('words', 'part_of_speech')
    op.drop_column('words', 'pronunciation')
