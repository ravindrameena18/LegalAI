"""Add document upload metadata and processing status fields.

Revision ID: 0002_document_metadata
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_document_metadata"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("file_type", sa.String(length=16), nullable=False, server_default="pdf"),
    )
    op.add_column(
        "documents",
        sa.Column("mime_type", sa.String(length=128), nullable=False, server_default="application/pdf"),
    )
    op.add_column(
        "documents",
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "documents",
        sa.Column("processing_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "documents",
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "document_versions",
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("document_versions", "file_size")
    op.drop_column("documents", "page_count")
    op.drop_column("documents", "error_message")
    op.drop_column("documents", "processing_status")
    op.drop_column("documents", "file_size")
    op.drop_column("documents", "mime_type")
    op.drop_column("documents", "file_type")

