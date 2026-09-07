"""Create comparisons table for document redlining and comparison.

Revision ID: 0004_comparisons_table
Revises: 0003_analysis_structured_data
Create Date: 2026-09-06 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_comparisons_table'
down_revision: Union[str, None] = '0003_analysis_structured_data'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comparisons',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('doc_a_id', sa.UUID(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doc_b_id', sa.UUID(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doc_a_label', sa.String(length=255), nullable=False),
        sa.Column('doc_b_label', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='completed'),
        sa.Column('result_data', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_comparisons_user_id'), 'comparisons', ['user_id'], unique=False)
    op.create_index(op.f('ix_comparisons_doc_a_id'), 'comparisons', ['doc_a_id'], unique=False)
    op.create_index(op.f('ix_comparisons_doc_b_id'), 'comparisons', ['doc_b_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_comparisons_doc_b_id'), table_name='comparisons')
    op.drop_index(op.f('ix_comparisons_doc_a_id'), table_name='comparisons')
    op.drop_index(op.f('ix_comparisons_user_id'), table_name='comparisons')
    op.drop_table('comparisons')

