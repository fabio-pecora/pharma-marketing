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

    for claim in approved_claims:

        keywords = extract_keywords(claim["claim_text"])

        matches = sum(1 for k in keywords if k in normalized_content)

        if matches < len(keywords) // 2:
            missing_claims.append(claim["claim_text"])

    if missing_claims:
        raise ValueError(
            f"Compliance warning: generated content may not reference approved claims -> {missing_claims}"
        )

    return True