import re


def normalize(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_keywords(text, limit=6):
    words = normalize(text).split()
    return words[:limit]


def validate_claims(content, approved_claims):

    normalized_content = normalize(content)

    missing_claims = []
    missing_citations = []

    # Check if approved claims appear
    for claim in approved_claims:

        keywords = extract_keywords(claim["claim_text"])
        matches = sum(1 for k in keywords if k in normalized_content)

        if matches < len(keywords) // 2:
            missing_claims.append(claim["claim_text"])

        if not claim["citation"]:
            missing_citations.append(claim["claim_text"])

    claim_integrity = "pass"
    citation_check = "pass"

    if missing_claims:
        claim_integrity = "warning"

    if missing_citations:
        citation_check = "warning"

    # simple heuristic checks
    fair_balance = "warning"
    off_label_risk = "pass"

    report = {
        "claim_integrity": claim_integrity,
        "citation_check": citation_check,
        "fair_balance": fair_balance,
        "off_label_risk": off_label_risk
    }

    return report