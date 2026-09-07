from typing import Any


def calculate_overall_risk(risks: list[Any]) -> dict[str, Any]:
    """
    Pure, deterministic legal risk calculation engine.

    Evaluates a collection of risk findings (from Analysis or Risk entities)
    and computes a consistent, source-grounded risk score and risk classification.

    The same findings always produce the exact same score and classification.
    """
    critical_count = 0
    high_count = 0
    medium_count = 0
    low_count = 0

    for r in risks:
        severity = ""
        if isinstance(r, dict):
            severity = str(r.get("severity", "")).upper().strip()
        elif hasattr(r, "severity"):
            severity = str(getattr(r, "severity", "")).upper().strip()

        if severity == "CRITICAL":
            critical_count += 1
        elif severity == "HIGH":
            high_count += 1
        elif severity == "MEDIUM":
            medium_count += 1
        elif severity == "LOW":
            low_count += 1

    total_findings = critical_count + high_count + medium_count + low_count

    # Weighted scoring formula
    # CRITICAL: 10 pts, HIGH: 5 pts, MEDIUM: 2 pts, LOW: 1 pt
    score = (critical_count * 10) + (high_count * 5) + (medium_count * 2) + (low_count * 1)

    # Deterministic classification rules
    if critical_count >= 2 or (critical_count >= 1 and high_count >= 1) or score >= 20:
        level = "CRITICAL"
    elif critical_count >= 1 or high_count >= 1 or score >= 5:
        level = "HIGH"
    elif medium_count >= 1 or score >= 2:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "level": level,
        "score": score,
        "counts": {
            "critical": critical_count,
            "high": high_count,
            "medium": medium_count,
            "low": low_count,
            "total": total_findings,
        },
        "summary": (
            f"{level} RISK: {total_findings} total findings "
            f"({critical_count} critical, {high_count} high, {medium_count} medium, {low_count} low). "
            f"Composite risk score: {score}."
        ),
    }

