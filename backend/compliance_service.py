import re

def normalize(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def validate_claims(content, approved_claims):

    normalized_content = normalize(content)

    for claim in approved_claims:
        normalized_claim = normalize(claim["claim_text"])

        if normalized_claim not in normalized_content:
            raise ValueError(
                f"Compliance error: approved claim missing or modified -> '{claim['claim_text']}'"
            )

    return True