"""add audio_url to words

Revision ID: e3a510c49db4
Revises: fd3f4bea9d85
Create Date: 2026-06-19 09:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3a510c49db4'
down_revision: Union[str, Sequence[str], None] = 'fd3f4bea9d85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('words', sa.Column('audio_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('words', 'audio_url')
