import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParsedQuery:
    raw_query: str
    cleaned_query: str
    act_code: str | None = None
    act_name: str | None = None
    section_number: str | None = None
    legal_concept: str | None = None
    court: str | None = None
    year: int | None = None
    citation: str | None = None
    is_latest_requested: bool = False
    is_old_law_query: bool = False
    detected_language: str = "en"
    keywords: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_query": self.raw_query,
            "cleaned_query": self.cleaned_query,
            "act_code": self.act_code,
            "act_name": self.act_name,
            "section_number": self.section_number,
            "legal_concept": self.legal_concept,
            "court": self.court,
            "year": self.year,
            "citation": self.citation,
            "is_latest_requested": self.is_latest_requested,
            "is_old_law_query": self.is_old_law_query,
            "detected_language": self.detected_language,
            "keywords": self.keywords,
        }


class LegalQueryParser:
    """
    Parser for natural language legal queries in English and Hinglish.
    Extracts acts, sections, legal concepts, courts, citations, and intent.
    """

    HINGLISH_STOPWORDS = {
        "mein", "kya", "hota", "hai", "ka", "ki", "ke", "kise", "kehte", "hain",
        "kaise", "hoga", "karein", "dekhna", "batao", "bataiye", "karen", "wali",
        "wale", "se", "par", "ko", "aur", "ya", "bhi"
    }

    # Common Act mappings
    ACT_PATTERNS: list[tuple[str, str, str, bool]] = [
        (r"\b(ipc|indian\s*penal\s*code)\b", "IPC", "Indian Penal Code, 1860", True),
        (r"\b(bns|bharatiya\s*nyaya\s*sanhita)\b", "BNS", "Bharatiya Nyaya Sanhita, 2023", False),
        (r"\b(crpc|criminal\s*procedure\s*code|code\s*of\s*criminal\s*procedure)\b", "CrPC", "Code of Criminal Procedure, 1973", True),
        (r"\b(bnss|bharatiya\s*nagarik\s*suraksha\s*sanhita)\b", "BNSS", "Bharatiya Nagarik Suraksha Sanhita, 2023", False),
        (r"\b(iea|evidence\s*act|indian\s*evidence\s*act)\b", "IEA", "Indian Evidence Act, 1872", True),
        (r"\b(bsa|bharatiya\s*sakshya\s*adhiniyam)\b", "BSA", "Bharatiya Sakshya Adhiniyam, 2023", False),
        (r"\b(ni\s*act|negotiable\s*instruments?\s*act)\b", "NI Act", "Negotiable Instruments Act, 1881", False),
        (r"\b(arbitration|arbitration\s*and\s*conciliation\s*act)\b", "Arbitration Act", "Arbitration and Conciliation Act, 1996", False),
        (r"\b(cpc|code\s*of\s*civil\s*procedure|civil\s*procedure\s*code)\b", "CPC", "Code of Civil Procedure, 1908", False),
        (r"\b(constitution|constitution\s*of\s*india|article)\b", "COI", "Constitution of India, 1950", False),
        (r"\b(contract|contract\s*act|indian\s*contract\s*act)\b", "Contract Act", "Indian Contract Act, 1872", False),
        (r"\b(limitation|limitation\s*act)\b", "Limitation Act", "Limitation Act, 1963", False),
        (r"\b(tpa|transfer\s*of\s*property\s*act)\b", "TPA", "Transfer of Property Act, 1882", False),
    ]

    # Concept associations
    CONCEPT_KEYWORDS = {
        "fraud": ("fraud & cheating", "BNS 318 or IPC 420", ["BNS", "IPC"]),
        "dhokhadhadi": ("fraud & cheating", "BNS 318 or IPC 420", ["BNS", "IPC"]),
        "cheating": ("cheating", "BNS 318 or IPC 420", ["BNS", "IPC"]),
        "chhal": ("cheating", "BNS 318 or IPC 420", ["BNS", "IPC"]),
        "jaan se maar": ("killing & murder", "BNS 101 or IPC 300", ["BNS", "IPC"]),
        "maar diya": ("killing & murder", "BNS 101 or IPC 300", ["BNS", "IPC"]),
        "hatya": ("killing & murder", "BNS 101 or IPC 300", ["BNS", "IPC"]),
        "killing": ("killing & murder", "BNS 101 or IPC 300", ["BNS", "IPC"]),
        "dhamki": ("criminal intimidation", "BNS 351 or IPC 503/506", ["BNS", "IPC"]),
        "threat": ("criminal intimidation", "BNS 351 or IPC 503/506", ["BNS", "IPC"]),
        "intimidation": ("criminal intimidation", "BNS 351 or IPC 503/506", ["BNS", "IPC"]),
        "kabja": ("criminal trespass & possession", "BNS 329 or IPC 441", ["BNS", "IPC"]),
        "property par kabja": ("criminal trespass & possession", "BNS 329 or IPC 441", ["BNS", "IPC"]),
        "trespass": ("criminal trespass", "BNS 329 or IPC 441", ["BNS", "IPC"]),
        "murder": ("murder", "BNS 101/103 or IPC 300/302", ["BNS", "IPC"]),
        "culpable homicide": ("culpable homicide", "IPC 299 or BNS 100", ["IPC", "BNS"]),
        "common intention": ("common intention", "IPC 34 or BNS 3(5)", ["IPC", "BNS"]),
        "cheque bounce": ("cheque bounce", "Section 138 NI Act", ["NI Act"]),
        "cheque": ("cheque dishonour", "Section 138 NI Act", ["NI Act"]),
        "dishonour of cheque": ("dishonour of cheque", "Section 138 NI Act", ["NI Act"]),
        "anticipatory bail": ("anticipatory bail", "CrPC 438 or BNSS 482", ["CrPC", "BNSS"]),
        "bail": ("bail", "CrPC 437/439 or BNSS 480/483", ["CrPC", "BNSS"]),
        "arbitration": ("arbitration agreement & referral", "Arbitration Act", ["Arbitration Act"]),
        "contract breach": ("breach of contract and damages", "Contract Act Section 73/74", ["Contract Act"]),
        "earnest money": ("forfeiture of earnest money", "Contract Act Section 74", ["Contract Act"]),
        "limitation period": ("limitation period & bar", "Limitation Act Section 3/5", ["Limitation Act"]),
        "privacy": ("right to privacy", "Constitution Article 21", ["COI"]),
        "electronic evidence": ("admissibility of electronic evidence", "IEA 65B or BSA 61/63", ["IEA", "BSA"]),
    }

    @classmethod
    def parse(cls, raw_query: str) -> ParsedQuery:
        query = (raw_query or "").strip()
        lowered = query.lower()

        # Check language
        has_hinglish = any(re.search(rf"\b{word}\b", lowered) for word in cls.HINGLISH_STOPWORDS)
        language = "hi-Latn" if has_hinglish else "en"

        # Check recency / latest request
        is_latest = bool(re.search(r"\b(latest|recent|newest|current|taza|haal)\b", lowered))

        # Check citation pattern: e.g. (2021) 2 SCC 1, 2023 INSC 1066, AIR 1954 SC 300
        citation_match = re.search(r"(\(?\d{4}\)?\s*\d*\s*(?:scc|insc|air|scr|scale|crlj)\s*(?:online\s*sc\s*)?\d*)", lowered)
        citation = citation_match.group(1).upper() if citation_match else None

        # Check court
        court = None
        if "supreme court" in lowered or "sc" in lowered.split():
            court = "Supreme Court of India"
        elif "high court" in lowered or "hc" in lowered.split():
            court = "High Court"

        # Check section number (e.g. "Section 300", "Sec 34", "s. 138", "Article 21", "Order 7 Rule 11")
        section_number = None
        sec_match = re.search(r"\b(?:section|sec|s\.?|u/s|article|art\.?)\s*(\d+[a-zA-Z]*(?:\([a-zA-Z0-9]+\))*)", lowered)
        if sec_match:
            section_number = sec_match.group(1).upper()
        else:
            # Look for isolated numbers right after act: "IPC 300", "BNS 103", "NI 138"
            isolated_sec = re.search(r"\b(?:ipc|bns|crpc|bnss|iea|bsa)\s*(\d+[a-zA-Z]*)", lowered)
            if isolated_sec:
                section_number = isolated_sec.group(1).upper()

        # Check act
        act_code = None
        act_name = None
        is_old_law = False
        for pattern, code, name, old_flag in cls.ACT_PATTERNS:
            if re.search(pattern, lowered):
                act_code = code
                act_name = name
                is_old_law = old_flag
                break

        # Check legal concept
        legal_concept = None
        for concept_key, (concept_name, default_sec, associated_acts) in cls.CONCEPT_KEYWORDS.items():
            if concept_key in lowered:
                legal_concept = concept_name
                # If no act was explicitly found, infer from concept
                if not act_code and associated_acts:
                    act_code = associated_acts[0]
                    # Map code to name
                    for _, code, name, old_flag in cls.ACT_PATTERNS:
                        if code == act_code:
                            act_name = name
                            is_old_law = old_flag
                            break
                break

        # If still no section, infer from concept or action
        if not section_number:
            if "fraud" in lowered or "dhokhadhadi" in lowered or "420" in lowered or "chhal" in lowered:
                section_number = "318" if act_code == "BNS" else "420"
                if not act_code:
                    act_code = "BNS"
                    act_name = "Bharatiya Nyaya Sanhita, 2023"
            elif "jaan se maar" in lowered or "maar diya" in lowered or "hatya" in lowered or "killing" in lowered or "murder" in lowered:
                section_number = "101" if act_code == "BNS" else "300"
                if not act_code:
                    act_code = "BNS"
                    act_name = "Bharatiya Nyaya Sanhita, 2023"
            elif "dhamki" in lowered or "threat" in lowered or "intimidation" in lowered:
                section_number = "351" if act_code == "BNS" else "506"
                if not act_code:
                    act_code = "BNS"
                    act_name = "Bharatiya Nyaya Sanhita, 2023"
            elif "kabja" in lowered or "trespass" in lowered:
                section_number = "329" if act_code == "BNS" else "441"
                if not act_code:
                    act_code = "BNS"
                    act_name = "Bharatiya Nyaya Sanhita, 2023"
            elif "cheque" in lowered or "bounce" in lowered:
                section_number = "138"
                if not act_code:
                    act_code = "NI Act"
                    act_name = "Negotiable Instruments Act, 1881"
            elif "anticipatory bail" in lowered:
                section_number = "482" if act_code == "BNSS" else "438"
                if not act_code:
                    act_code = "CrPC"
                    act_name = "Code of Criminal Procedure, 1973"
                    is_old_law = True

        # Extract meaningful keywords excluding stop words
        tokens = re.findall(r"\b[a-zA-Z0-9]+\b", lowered)
        keywords = [
            t for t in tokens
            if t not in cls.HINGLISH_STOPWORDS
            and t not in {"section", "sec", "act", "of", "in", "and", "the", "for", "to", "what", "is"}
        ]

        cleaned_query = " ".join(keywords)

        return ParsedQuery(
            raw_query=query,
            cleaned_query=cleaned_query,
            act_code=act_code,
            act_name=act_name,
            section_number=section_number,
            legal_concept=legal_concept,
            court=court,
            year=None,
            citation=citation,
            is_latest_requested=is_latest,
            is_old_law_query=is_old_law,
            detected_language=language,
            keywords=keywords,
        )

