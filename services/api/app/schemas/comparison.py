from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ComparisonCreateRequest(BaseModel):
    doc_a_id: UUID = Field(..., description="UUID of first document (Document 1)")
    doc_b_id: UUID = Field(..., description="UUID of second document (Document 2)")
    doc_a_label: str | None = Field(default=None, description="Optional custom version label for Document 1")
    doc_b_label: str | None = Field(default=None, description="Optional custom version label for Document 2")


class ClauseComparisonItem(BaseModel):
    topic: str = Field(..., description="Legal topic or clause name (e.g. Liability, Termination, Payment)")
    clause_title: str | None = Field(default=None, description="Title of the clause or contractual provision")
    change_type: Literal["added", "removed", "modified", "unchanged"] = Field(
        ..., description="Type of difference between Document 1 and Document 2"
    )
    risk_level: Literal["HIGH", "MEDIUM", "LOW", "NONE"] = Field(
        default="NONE", description="Legal risk classification"
    )
    risk_score: float = Field(
        default=0.0, description="Numerical risk score from 0.0 (negligible) to 10.0 (critical)"
    )
    risk_reason: str = Field(
        default="", description="Specific directional justification for the assigned risk level"
    )
    legal_impact: str = Field(
        default="", description="Objective legal and operational consequence of this change"
    )
    doc_a_text: str | None = Field(default=None, description="Verbatim clause text from Document 1")
    doc_b_text: str | None = Field(default=None, description="Verbatim clause text from Document 2")
    document_1_text: str | None = Field(default=None, description="Verbatim clause text from Document 1")
    document_2_text: str | None = Field(default=None, description="Verbatim clause text from Document 2")
    doc_a_page: int | None = Field(default=None, description="Page number in Document 1")
    doc_b_page: int | None = Field(default=None, description="Page number in Document 2")
    document_1_page: int | None = Field(default=None, description="Page number in Document 1")
    document_2_page: int | None = Field(default=None, description="Page number in Document 2")
    doc_a_section: str | None = Field(default=None, description="Section heading in Document 1")
    doc_b_section: str | None = Field(default=None, description="Section heading in Document 2")
    change_summary: str = Field(..., description="Objective synthesis of the change or difference")

    @model_validator(mode="after")
    def sync_aliases(self) -> "ClauseComparisonItem":
        if not self.clause_title:
            self.clause_title = self.topic
        if not self.topic and self.clause_title:
            self.topic = self.clause_title
        if self.doc_a_text and not self.document_1_text:
            self.document_1_text = self.doc_a_text
        elif self.document_1_text and not self.doc_a_text:
            self.doc_a_text = self.document_1_text
        if self.doc_b_text and not self.document_2_text:
            self.document_2_text = self.doc_b_text
        elif self.document_2_text and not self.doc_b_text:
            self.doc_b_text = self.document_2_text
        if self.doc_a_page is not None and self.document_1_page is None:
            self.document_1_page = self.doc_a_page
        elif self.document_1_page is not None and self.doc_a_page is None:
            self.doc_a_page = self.document_1_page
        if self.doc_b_page is not None and self.document_2_page is None:
            self.document_2_page = self.doc_b_page
        elif self.document_2_page is not None and self.doc_b_page is None:
            self.doc_b_page = self.document_2_page
        return self


class ImportantChangeItem(BaseModel):
    title: str = Field(..., description="Brief title of the high-impact legal change")
    category: str = Field(..., description="Legal category e.g. Financial, Risk/Liability, Operational")
    severity: Literal["HIGH", "MEDIUM", "LOW"] = Field(..., description="Risk or importance severity")
    description: str = Field(..., description="Clear explanation of the modification")
    legal_impact: str = Field(..., description="Objective business and legal consequence")


class ComparisonMetrics(BaseModel):
    total_changes: int = Field(default=0, description="Total clauses with additions, removals, or modifications")
    added_count: int = Field(default=0, description="Count of added clauses in Document 2")
    removed_count: int = Field(default=0, description="Count of removed clauses from Document 1")
    modified_count: int = Field(default=0, description="Count of modified clauses")
    unchanged_count: int = Field(default=0, description="Count of unchanged key clauses")
    overall_risk_impact: Literal["HIGH", "MEDIUM", "LOW", "NEUTRAL"] = Field(
        default="NEUTRAL", description="Aggregate risk trajectory"
    )


class ComparisonResultData(BaseModel):
    executive_summary: str = Field(..., description="Narrative summary highlighting core differences")
    doc_a_title: str = Field(..., description="Resolved label or filename for Document 1")
    doc_b_title: str = Field(..., description="Resolved label or filename for Document 2")
    metrics: ComparisonMetrics = Field(..., description="Numerical summary metrics")
    important_changes: list[ImportantChangeItem] = Field(
        default_factory=list, description="Top key differences ranked by importance"
    )
    clause_comparisons: list[ClauseComparisonItem] = Field(
        default_factory=list, description="Side-by-side clause level comparisons"
    )
    analysis_method: Literal["ai_analyzed", "document_text_comparison", "ai_unavailable"] = Field(
        default="document_text_comparison",
        description="Mechanism used: ai_analyzed, document_text_comparison, or ai_unavailable",
    )
    analysis_method_label: str = Field(
        default="Document Text Comparison",
        description="Human-readable label for analysis method",
    )
    ai_status_message: str | None = Field(
        default=None,
        description="Detailed message regarding AI status or unavailability",
    )
    doc_a_file_hash: str | None = Field(
        default=None,
        description="SHA-256 hash of Document 1 content",
    )
    doc_b_file_hash: str | None = Field(
        default=None,
        description="SHA-256 hash of Document 2 content",
    )
    comparison_source: str = Field(
        default="Fresh PDF extraction",
        description="Source of extracted comparison text",
    )


class ComparisonResponse(BaseModel):
    id: UUID
    doc_a_id: UUID
    doc_b_id: UUID
    doc_a_label: str
    doc_b_label: str
    status: str
    result_data: ComparisonResultData
    created_at: datetime

