from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    text: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    file_type: str
    mime_type: str
    file_size: int
    status: str
    processing_status: str
    page_count: int
    is_encrypted: bool = False
    created_at: datetime
    updated_at: datetime
    error_message: str | None = None


class DocumentChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_id: UUID
    page_id: UUID | None = None
    text: str
    metadata_json: dict = {}


class DocumentDetailResponse(DocumentResponse):
    pages: list[DocumentPageResponse] = []
    chunks: list[DocumentChunkResponse] = []
    storage_key: str | None = None


class UnlockDocumentRequest(BaseModel):
    password: str


class CitationSchema(BaseModel):
    page: int | None = None
    section: str | None = None
    title: str | None = None
    text: str | None = None
    explanation: str | None = None


class DocumentQARequest(BaseModel):
    question: str


class DocumentQAResponse(BaseModel):
    answer: str
    citations: list[CitationSchema] = []
    found_in_document: bool = True
    language_detected: str = "en"
    risk: dict | None = None
