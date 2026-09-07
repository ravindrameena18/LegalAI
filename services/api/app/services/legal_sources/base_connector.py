from abc import ABC, abstractmethod
from typing import Any
from app.schemas.legal_research import CaseLawResponse, LegalProvisionResponse, OfficialSourceItem


class BaseSourceConnector(ABC):
    """
    Abstract connector interface for verified legal sources.
    All official sources (Supreme Court, High Courts, India Code, eCourts)
    inherit from this interface and enforce strict provenance.
    """

    @property
    @abstractmethod
    def source_id(self) -> str:
        """Unique identifier of the source."""
        pass

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable display name of the source."""
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        """Type of source (e.g. Official Court Registry, Legislative Database)."""
        pass

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Canonical official URL for this authority."""
        pass

    @abstractmethod
    def get_source_metadata(self) -> OfficialSourceItem:
        """Returns standard metadata item for the source."""
        pass

    @abstractmethod
    async def search_cases(self, query: str, filters: dict[str, Any] | None = None) -> list[CaseLawResponse]:
        """Search case law records within this source."""
        pass

    @abstractmethod
    async def get_provision(self, act_code: str, section: str) -> LegalProvisionResponse | None:
        """Retrieve statutory provision if supported by this source."""
        pass

