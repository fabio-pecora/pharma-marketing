def validate_claims(content, claims):

    approved_claims = [c["claim_text"].lower() for c in claims]

    content_lower = content.lower()

    for sentence in content_lower.split("."):
        sentence = sentence.strip()

        if not sentence:
            continue

        if not any(claim in sentence for claim in approved_claims):
            return False

    return True