"""Add structured_data, error_message, and document_id to analyses table.

Revision ID: 0003_analysis_structured_data
Revises: 0002_document_metadata
Create Date: 2026-09-02 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003_analysis_structured_data'
down_revision: Union[str, None] = '0002_document_metadata'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'analyses',
        sa.Column('document_id', sa.UUID(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=True)
    )
    op.create_index(op.f('ix_analyses_document_id'), 'analyses', ['document_id'], unique=False)
    op.add_column(
        'analyses',
        sa.Column('structured_data', sa.JSON(), server_default='{}', nullable=False)
    )
    op.add_column(
        'analyses',
        sa.Column('error_message', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('analyses', 'error_message')
    op.drop_column('analyses', 'structured_data')
    op.drop_index(op.f('ix_analyses_document_id'), table_name='analyses')
    op.drop_column('analyses', 'document_id')

