import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.dependencies import get_db
from app.database.models import (
    Analysis,
    ChatMessage,
    ChatSession,
    Clause,
    Document,
    DocumentChunk,
    DocumentPage,
    DocumentVersion,
    Finding,
    Report,
    Risk,
    User,
)
from app.document_processing.extractor import extract_document_text
from app.document_processing.validator import validate_uploaded_file
from app.schemas.documents import (
    DocumentChunkResponse,
    DocumentDetailResponse,
    DocumentPageResponse,
    DocumentQARequest,
    DocumentQAResponse,
    DocumentResponse,
    UnlockDocumentRequest,
)
from app.security.dependencies import require_permission
from app.security.permissions import Permission
from app.services.audit import record_audit_event
from app.services.document_access import get_user_documents, verify_document_ownership
from app.services.qa_service import ask_document_qa
from app.storage import get_storage_service

logger = logging.getLogger("legalai.documents")
router = APIRouter()
settings = get_settings()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    password: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_UPLOAD)),
) -> DocumentResponse:
    """
    Upload, validate, store, and process a legal document (PDF, DOCX, TXT).
    Extracts text, detects password protection, and detects image-only/scanned files requiring OCR.
    """
    content = await file.read()

    # Validate file extension, magic headers, size, and prohibited types
    validated = validate_uploaded_file(
        filename=file.filename,
        content=content,
        content_type_header=file.content_type,
        max_bytes=settings.max_upload_bytes,
    )

    # Perform text extraction (pypdf, python-docx, or plain text)
    extraction = extract_document_text(validated.content, validated.file_type, password=password)

    # If extraction decrypted the PDF, persist the unencrypted stream so future access needs no password
    file_content_to_save = extraction.unencrypted_content if extraction.unencrypted_content else validated.content
    saved_file_size = len(file_content_to_save)

    doc_id = uuid4()
    version_id = uuid4()
    storage = get_storage_service()

    # Save to private isolated storage
    storage_key = storage.save_file(
        user_id=current_user.id,
        document_id=doc_id,
        filename=validated.filename,
        content=file_content_to_save,
    )

    # Create Document record
    document = Document(
        id=doc_id,
        owner_id=current_user.id,
        name=validated.filename,
        file_type=validated.file_type,
        mime_type=validated.mime_type,
        file_size=saved_file_size,
        status=extraction.status,
        processing_status=extraction.status,
        error_message=extraction.error_message,
        page_count=extraction.page_count,
        is_encrypted=extraction.is_encrypted,
    )

    # Create DocumentVersion record
    version = DocumentVersion(
        id=version_id,
        document_id=doc_id,
        storage_key=storage_key,
        content_type=validated.mime_type,
        file_size=saved_file_size,
    )

    db.add(document)
    db.add(version)

    # Save extracted pages and DocumentChunk records for RAG retrieval
    chunk_count = 0
    total_text_len = 0
    page_objects: list[DocumentPage] = []
    for page in extraction.pages:
        page_id = uuid4()
        page_text = page.text or ""
        total_text_len += len(page_text)
        p_obj = DocumentPage(
            id=page_id,
            version_id=version_id,
            page_number=page.page_number,
            text=page_text,
        )
        db.add(p_obj)
        page_objects.append(p_obj)

    # Flush DocumentPage records so foreign keys exist in PostgreSQL
    db.flush()

    for p_obj in page_objects:
        if p_obj.text.strip():
            db.add(
                DocumentChunk(
                    id=uuid4(),
                    version_id=version_id,
                    page_id=p_obj.id,
                    text=p_obj.text,
                    metadata_json={
                        "page_number": p_obj.page_number,
                        "document_id": str(doc_id),
                        "char_count": len(p_obj.text),
                    },
                )
            )
            chunk_count += 1

    db.commit()
    db.refresh(document)

    logger.info(
        "Document uploaded & processed: document_id=%s, extraction_status=%s, extracted_text_length=%d, pages=%d, chunk_count=%d, is_encrypted=%s",
        str(doc_id),
        extraction.status,
        total_text_len,
        len(extraction.pages),
        chunk_count,
        extraction.is_encrypted,
    )

    record_audit_event(
        db=db,
        action="document.upload",
        resource_type="document",
        actor_id=current_user.id,
        resource_id=str(document.id),
        metadata={
            "filename": document.name,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "status": document.status,
            "pages": document.page_count,
            "chunk_count": chunk_count,
        },
    )

    return DocumentResponse.model_validate(document)


@router.get("", response_model=list[DocumentResponse], status_code=status.HTTP_200_OK)
def list_documents(
    file_type: str | None = Query(default=None),
    processing_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> list[DocumentResponse]:
    """
    List documents accessible to the current authenticated user.
    Enforces user ownership boundary so User A cannot see User B's documents.
    """
    docs = get_user_documents(
        db=db,
        user=current_user,
        file_type=file_type,
        processing_status=processing_status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [DocumentResponse.model_validate(doc) for doc in docs]


@router.get("/{document_id}", response_model=DocumentDetailResponse, status_code=status.HTTP_200_OK)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> DocumentDetailResponse:
    """
    Retrieve document by ID with extracted pages.
    Enforces ownership: returns 404 if not owned by user to prevent resource existence leak.
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=document_id)

    # Load latest version
    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )

    pages: list[DocumentPageResponse] = []
    chunks: list[DocumentChunkResponse] = []
    storage_key = None
    if version:
        storage_key = version.storage_key
        page_records = list(
            db.scalars(
                select(DocumentPage)
                .where(DocumentPage.version_id == version.id)
                .order_by(DocumentPage.page_number)
            ).all()
        )
        pages = [DocumentPageResponse.model_validate(p) for p in page_records]
        chunk_records = list(
            db.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.version_id == version.id)
            ).all()
        )
        chunks = [DocumentChunkResponse.model_validate(c) for c in chunk_records]

    logger.info(
        "Retrieved document: document_id=%s, extraction_status=%s, pages=%d, chunk_count=%d, text_length=%d",
        str(doc.id),
        doc.status,
        len(pages),
        len(chunks),
        sum(len(p.text or "") for p in pages),
    )

    return DocumentDetailResponse(
        id=doc.id,
        name=doc.name,
        file_type=doc.file_type,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        status=doc.status,
        processing_status=doc.processing_status,
        page_count=doc.page_count,
        is_encrypted=doc.is_encrypted,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        error_message=doc.error_message,
        pages=pages,
        chunks=chunks,
        storage_key=storage_key,
    )


@router.post("/{document_id}/unlock", response_model=DocumentDetailResponse, status_code=status.HTTP_200_OK)
def unlock_document(
    document_id: UUID,
    payload: UnlockDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_UPLOAD)),
) -> DocumentDetailResponse:
    """
    Unlock and decrypt a password-protected document with user-supplied password.
    Overwrites stored encrypted file with decrypted version, extracts text pages,
    and sets document status to 'ready' (or 'ocr_required' if scanned).
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=document_id)

    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document version not found.")

    storage = get_storage_service()
    try:
        content = storage.get_file(version.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage.")

    # Attempt extraction with supplied password
    extraction = extract_document_text(content, doc.file_type, password=payload.password)

    if extraction.status == "password_required":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Please try again.",
        )

    if not extraction.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=extraction.error_message or "Failed to decrypt document.",
        )

    try:
        # Purge old page and chunk records for this version to prevent stale/empty data
        db.execute(delete(DocumentChunk).where(DocumentChunk.version_id == version.id))
        db.execute(delete(DocumentPage).where(DocumentPage.version_id == version.id))
        db.flush()

        # Update document status and metadata (preserve original uploaded file intact)
        doc.status = extraction.status
        doc.processing_status = extraction.status
        doc.page_count = extraction.page_count
        doc.is_encrypted = False
        doc.error_message = extraction.error_message

        chunk_count = 0
        total_text_len = 0
        page_objects: list[DocumentPage] = []
        for page in extraction.pages:
            page_id = uuid4()
            page_text = page.text or ""
            total_text_len += len(page_text)
            p_obj = DocumentPage(
                id=page_id,
                version_id=version.id,
                page_number=page.page_number,
                text=page_text,
            )
            db.add(p_obj)
            page_objects.append(p_obj)

        # Flush DocumentPage records so foreign keys exist in PostgreSQL before inserting chunks
        db.flush()

        for p_obj in page_objects:
            if p_obj.text.strip():
                db.add(
                    DocumentChunk(
                        id=uuid4(),
                        version_id=version.id,
                        page_id=p_obj.id,
                        text=p_obj.text,
                        metadata_json={
                            "page_number": p_obj.page_number,
                            "document_id": str(doc.id),
                            "char_count": len(p_obj.text),
                        },
                    )
                )
                chunk_count += 1

        db.commit()
        db.refresh(doc)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to unlock and index document %s: %s", str(doc.id), exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document after unlocking.",
        )

    logger.info(
        "Document unlocked & re-indexed: document_id=%s, extraction_status=%s, extracted_text_length=%d, pages=%d, chunk_count=%d, index_status=ready",
        str(doc.id),
        doc.status,
        total_text_len,
        len(extraction.pages),
        chunk_count,
    )

    record_audit_event(
        db=db,
        action="document.unlock",
        resource_type="document",
        actor_id=current_user.id,
        resource_id=str(doc.id),
        metadata={
            "filename": doc.name,
            "status": doc.status,
            "pages": doc.page_count,
            "chunk_count": chunk_count,
        },
    )

    page_records = list(
        db.scalars(
            select(DocumentPage)
            .where(DocumentPage.version_id == version.id)
            .order_by(DocumentPage.page_number)
        ).all()
    )
    pages = [DocumentPageResponse.model_validate(p) for p in page_records]
    chunk_records = list(
        db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.version_id == version.id)
        ).all()
    )
    chunks = [DocumentChunkResponse.model_validate(c) for c in chunk_records]

    return DocumentDetailResponse(
        id=doc.id,
        name=doc.name,
        file_type=doc.file_type,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        status=doc.status,
        processing_status=doc.processing_status,
        page_count=doc.page_count,
        is_encrypted=doc.is_encrypted,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        error_message=doc.error_message,
        pages=pages,
        chunks=chunks,
        storage_key=version.storage_key,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> Response:
    """
    Download the original stored document file.
    Enforces ownership and safe binary delivery.
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=document_id)
    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    if not version:
        return Response(status_code=status.HTTP_404_NOT_FOUND, content="Document version not found.")

    storage = get_storage_service()
    try:
        content = storage.get_file(version.storage_key)
    except FileNotFoundError:
        return Response(status_code=status.HTTP_404_NOT_FOUND, content="File not found in storage.")

    # Sanitize header filename
    safe_ascii_name = doc.name.encode("ascii", "replace").decode("ascii").replace('"', "")
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_ascii_name}"',
        "Content-Length": str(len(content)),
    }
    return Response(content=content, media_type=doc.mime_type, headers=headers)


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_DELETE)),
) -> dict[str, str]:
    """
    Delete a document and its stored physical files.
    Enforces ownership, preserves chat sessions with unlinked document,
    and completely purges all related physical files and database records.
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=document_id)

    # 1. Clean up physical storage files for document versions
    storage = get_storage_service()
    versions = list(
        db.scalars(
            select(DocumentVersion).where(DocumentVersion.document_id == document_id)
        ).all()
    )
    for v in versions:
        try:
            storage.delete_file(v.storage_key)
        except Exception:
            pass

    version_ids = [v.id for v in versions]

    # 2. Safely preserve existing chat sessions by setting version_id to NULL
    if version_ids:
        db.execute(
            update(ChatSession)
            .where(ChatSession.version_id.in_(version_ids))
            .values(version_id=None)
        )
        # Purge extracted chunks/vector data and raw extracted pages
        db.execute(delete(DocumentChunk).where(DocumentChunk.version_id.in_(version_ids)))
        db.execute(delete(DocumentPage).where(DocumentPage.version_id.in_(version_ids)))

    # 3. Clean up analysis, reports, and report physical files
    analyses = list(
        db.scalars(select(Analysis).where(Analysis.document_id == document_id)).all()
    )
    analysis_ids = [a.id for a in analyses]
    if analysis_ids:
        reports = list(
            db.scalars(select(Report).where(Report.analysis_id.in_(analysis_ids))).all()
        )
        for r in reports:
            if r.storage_key:
                try:
                    storage.delete_file(r.storage_key)
                except Exception:
                    pass
        db.execute(delete(Report).where(Report.analysis_id.in_(analysis_ids)))
        db.execute(delete(Clause).where(Clause.analysis_id.in_(analysis_ids)))
        db.execute(delete(Risk).where(Risk.analysis_id.in_(analysis_ids)))
        db.execute(delete(Finding).where(Finding.analysis_id.in_(analysis_ids)))
        db.execute(delete(Analysis).where(Analysis.id.in_(analysis_ids)))

    # 4. Clean up document versions
    if version_ids:
        db.execute(delete(DocumentVersion).where(DocumentVersion.id.in_(version_ids)))

    # 5. Clean up any remaining document folder in storage
    try:
        user_folder = getattr(storage, "root", None)
        if user_folder:
            doc_folder = user_folder / str(current_user.id) / str(document_id)
            if doc_folder.is_dir():
                import shutil
                shutil.rmtree(doc_folder, ignore_errors=True)
    except Exception:
        pass

    # 6. Delete database record
    db.delete(doc)
    db.commit()

    record_audit_event(
        db=db,
        action="document.delete",
        resource_type="document",
        actor_id=current_user.id,
        resource_id=str(document_id),
        metadata={"filename": doc.name},
    )

    return {"message": "Document deleted successfully."}


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkResponse], status_code=status.HTTP_200_OK)
def get_document_chunks(
    document_id: UUID,
    query: str | None = Query(default=None, description="Optional search query keyword to filter chunks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> list[DocumentChunkResponse]:
    """
    Retrieve document chunks for RAG context and retrieval grounding.
    Enforces ownership boundary and logs diagnostic retrieval count.
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=document_id)

    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    if not version:
        return []

    chunk_records = list(
        db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.version_id == version.id)
        ).all()
    )

    if query and query.strip():
        q_lower = query.strip().lower()
        filtered = [c for c in chunk_records if q_lower in (c.text or "").lower()]
        logger.info(
            "Chat/RAG retrieval query: document_id=%s, query_length=%d, retrieved_chunk_count=%d, total_chunks=%d",
            str(doc.id),
            len(query),
            len(filtered),
            len(chunk_records),
        )
        return [DocumentChunkResponse.model_validate(c) for c in filtered]

    logger.info(
        "Chat/RAG retrieval all chunks: document_id=%s, total_chunks=%d",
        str(doc.id),
        len(chunk_records),
    )
    return [DocumentChunkResponse.model_validate(c) for c in chunk_records]


@router.post("/{document_id}/ask", response_model=DocumentQAResponse, status_code=status.HTTP_200_OK)
async def ask_document(
    document_id: UUID,
    payload: DocumentQARequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> DocumentQAResponse:
    """
    Ask a question about a document in English, Hindi, or Hinglish.
    Answers strictly using the document's content and mirrors the query language.
    """
    return await ask_document_qa(
        db=db,
        user=current_user,
        document_id=document_id,
        question=payload.question,
    )
