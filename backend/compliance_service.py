def validate_claims(content, approved_claims):

    content_lower = content.lower()

    for claim in approved_claims:
        claim_text = claim["claim_text"].lower()

        if claim_text in content_lower:
            return True

    # if nothing matched we mark for review but DO NOT crash
    return False