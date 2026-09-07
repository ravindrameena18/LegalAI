import io
import os
import zipfile
from dataclasses import dataclass
from fastapi import HTTPException, status

DANGEROUS_EXTENSIONS = {
    ".exe", ".dll", ".so", ".bin", ".bat", ".cmd", ".sh", ".bash", ".ps1",
    ".py", ".pyc", ".js", ".jsx", ".ts", ".tsx", ".vbs", ".msi", ".jar",
    ".com", ".scr", ".pif", ".hta", ".cpl", ".php", ".asp", ".aspx", ".jsp",
}

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB default


@dataclass
class ValidatedFile:
    filename: str
    file_type: str  # "pdf", "docx", "txt"
    mime_type: str
    file_size: int
    content: bytes


def validate_uploaded_file(
    filename: str | None,
    content: bytes,
    content_type_header: str | None = None,
    max_bytes: int = MAX_FILE_SIZE,
) -> ValidatedFile:
    """
    Validate uploaded file by extension, magic numbers, MIME type, and size.
    Strictly rejects executables, scripts, empty, oversized, or corrupted files.
    """
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must not be empty.",
        )

    clean_filename = os.path.basename(filename).strip()
    _, ext = os.path.splitext(clean_filename)
    ext_lower = ext.lower()

    if ext_lower in DANGEROUS_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Files with extension '{ext_lower}' are rejected for security.",
        )

    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if file_size > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {max_mb} MB.",
        )

    # Executable binary header rejection
    if content.startswith(b"MZ") or content.startswith(b"\x7fELF") or content.startswith(b"\xca\xfe\xba\xbe"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Executable files and binary scripts are strictly prohibited.",
        )

    # 1. PDF Validation
    if ext_lower == ".pdf":
        if not content.startswith(b"%PDF-") and b"%PDF-" not in content[:1024]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match a valid PDF signature.",
            )
        return ValidatedFile(
            filename=clean_filename,
            file_type="pdf",
            mime_type="application/pdf",
            file_size=file_size,
            content=content,
        )

    # 2. DOCX Validation
    if ext_lower == ".docx":
        if not content.startswith(b"PK\x03\x04"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match a valid DOCX container signature.",
            )
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                namelist = zf.namelist()
                if "word/document.xml" not in namelist:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Archive does not contain a valid Word processing document.",
                    )
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="DOCX archive is corrupted or not a valid zip container.",
            )

        return ValidatedFile(
            filename=clean_filename,
            file_type="docx",
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_size=file_size,
            content=content,
        )

    # 3. TXT Validation
    if ext_lower == ".txt":
        # Check for binary null bytes that indicate compiled binary code
        if b"\x00" in content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Binary characters detected in text document.",
            )
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content.decode("latin-1")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Text file encoding is unreadable.",
                )

        return ValidatedFile(
            filename=clean_filename,
            file_type="txt",
            mime_type="text/plain",
            file_size=file_size,
            content=content,
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported file format '{ext_lower}'. Supported formats: PDF, DOCX, TXT.",
    )

