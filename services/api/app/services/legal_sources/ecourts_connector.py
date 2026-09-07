from datetime import datetime, timezone
from typing import Any
from app.schemas.legal_research import CaseLawResponse, LegalProvisionResponse, OfficialSourceItem
from app.services.legal_sources.base_connector import BaseSourceConnector


class ECourtsConnector(BaseSourceConnector):
    """
    Official connector for eCourts Integrated Mission Mode Project (High Courts & District Courts).
    Canonical portal: https://ecourts.gov.in/
    When live registry credentials are not configured, surfaces official portal metadata
    without fabricating case registries.
    """

    source_id = "ecourts_services"
    source_name = "eCourts Services / High Courts"
    source_type = "Official Court Services Portal"
    base_url = "https://ecourts.gov.in/"

    def get_source_metadata(self) -> OfficialSourceItem:
        return OfficialSourceItem(
            id=self.source_id,
            name=self.source_name,
            source_type=self.source_type,
            description="National eCourts portal covering High Courts, District Courts, and Subordinate Judicial Services across India.",
            official_url=self.base_url,
            status="OFFICIAL_PORTAL",
            retrieved_at=datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC"),
        )

    async def search_cases(self, query: str, filters: dict[str, Any] | None = None) -> list[CaseLawResponse]:
        # Live external API integration requires court token; returns empty rather than fabricating
        return []

    async def get_provision(self, act_code: str, section: str) -> LegalProvisionResponse | None:
        return None

