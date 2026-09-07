from enum import StrEnum
from pathlib import Path
from typing import Protocol


class DocumentFormat(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


class TextPage(Protocol):
    page_number: int
    text: str


class DocumentExtractor(Protocol):
    supported_format: DocumentFormat

    def extract(self, path: Path) -> list[TextPage]: ...


class OCRProvider(Protocol):
    async def extract(self, path: Path) -> list[TextPage]: ...


class DocumentProcessor(Protocol):
    async def process(self, path: Path, document_format: DocumentFormat) -> list[TextPage]: ...
