"""
Legal Sources Package

Provides verified connectors to Indian courts and legislative databases,
authoritative transition mapping between Old Law (IPC/CrPC/IEA) and
Current Law (BNS/BNSS/BSA), and natural language query parsing.
"""

from app.services.legal_sources.base_connector import BaseSourceConnector
from app.services.legal_sources.query_parser import LegalQueryParser, ParsedQuery
from app.services.legal_sources.statute_registry import StatuteRegistry
from app.services.legal_sources.supreme_court_connector import SupremeCourtConnector
from app.services.legal_sources.india_code_connector import IndiaCodeConnector
from app.services.legal_sources.ecourts_connector import ECourtsConnector

__all__ = [
    "BaseSourceConnector",
    "LegalQueryParser",
    "ParsedQuery",
    "StatuteRegistry",
    "SupremeCourtConnector",
    "IndiaCodeConnector",
    "ECourtsConnector",
]

