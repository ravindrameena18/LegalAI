from datetime import datetime, timezone
from typing import Any
from app.schemas.legal_research import CaseLawResponse, LegalProvisionResponse, OfficialSourceItem
from app.services.legal_sources.base_connector import BaseSourceConnector
from app.services.legal_sources.statute_registry import StatuteRegistry


class IndiaCodeConnector(BaseSourceConnector):
    """
    Verified connector for India Code (Legislative Department, Ministry of Law and Justice).
    Canonical official portal: https://www.indiacode.nic.in/
    Provides verified legislative enactments, Central Acts, and State Acts.
    """

    source_id = "india_code_portal"
    source_name = "India Code / Ministry of Law and Justice"
    source_type = "Official Legislative Database"
    base_url = "https://www.indiacode.nic.in/"

    def get_source_metadata(self) -> OfficialSourceItem:
        return OfficialSourceItem(
            id=self.source_id,
            name=self.source_name,
            source_type=self.source_type,
            description="Digital repository of all Central and State Acts, Gazette Notifications, and Legislative Enactments in India.",
            official_url=self.base_url,
            status="CONNECTED",
            retrieved_at=datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC"),
        )

    async def search_cases(self, query: str, filters: dict[str, Any] | None = None) -> list[CaseLawResponse]:
        # India Code hosts statutes and legislative enactments, not court case records
        return []

    async def get_provision(self, act_code: str, section: str) -> LegalProvisionResponse | None:
        return StatuteRegistry.get_provision(act_code, section)

