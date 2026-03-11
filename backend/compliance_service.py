import re
import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# -----------------------------
# AI COMPLIANCE REVIEW
# -----------------------------
def llm_compliance_review(content, approved_claims):

    claims_text = "\n".join(
        [f"- {c['claim_text']} (Citation: {c['citation']})" for c in approved_claims]
    )

    prompt = f"""
You are a pharmaceutical Medical / Legal / Regulatory (MLR) reviewer.

APPROVED CLAIMS THAT WERE SELECTED:

{claims_text}

GENERATED CONTENT:

{content}

Evaluate whether the generated content correctly reflects the approved claims.

Rules:

1. Claim Integrity
The generated content must reflect the meaning of the approved claims.

2. Citation Check
Should always show pass because I always show Approved Claims Used in the website 
3. Fair Balance
Check if benefits are presented without any safety or risk context.

Safety context can include:
• explicit risks
• adverse reactions
• safety profile discussion
• statements advising consultation of prescribing information

If any safety acknowledgement exists, consider fair balance present.

4. Off Label Risk
Check if the content mentions cancers not approved for this therapy.

Respond ONLY with JSON.

FORMAT:

{{
"claim_integrity": "pass | warning | fail",
"citation_check": "pass | warning | fail",
"fair_balance": "pass | warning | fail",
"off_label_risk": "pass | warning | fail"
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=[
                {"role": "system", "content": "You are a pharmaceutical compliance reviewer."},
                {"role": "user", "content": prompt}
            ]
        )

        text = response.choices[0].message.content.strip()

        start = text.find("{")
        end = text.rfind("}") + 1
        json_text = text[start:end]

        return json.loads(json_text)

    except Exception:
        return {
            "claim_integrity": "warning",
            "citation_check": "warning",
            "fair_balance": "warning",
            "off_label_risk": "warning"
        }


# -----------------------------
# TEXT UTILITIES
# -----------------------------
def normalize(text):
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_keywords(text, limit=6):
    words = normalize(text).split()
    return words[:limit]


# -----------------------------
# CLAIM VALIDATION (RULE BASED)
# -----------------------------
def validate_claim_integrity(content, approved_claims):

    normalized_content = normalize(content)

    for claim in approved_claims:

        keywords = extract_keywords(claim["claim_text"])

        matches = sum(1 for k in keywords if k in normalized_content)

        if matches < max(1, len(keywords) // 2):
            return "warning"

    return "pass"


# -----------------------------
# OFF LABEL CHECK (RULE BASED)
# -----------------------------
def check_off_label(content):

    normalized_content = normalize(content)

    other_cancers = [
        "pancreatic cancer",
        "lung cancer",
        "breast cancer",
        "melanoma",
        "prostate cancer"
    ]

    if any(cancer in normalized_content for cancer in other_cancers):
        return "fail"

    return "pass"

# -----------------------------
# FAIR BALANCE RULE CHECK
# -----------------------------
def detect_safety_language(content):

    normalized = normalize(content)

    safety_terms = [
        "safety",
        "side effects",
        "adverse",
        "risk",
        "risks",
        "safety profile",
        "prescribing information",
        "warnings",
        "precautions"
    ]

    if any(term in normalized for term in safety_terms):
        return "pass"

    return "warning"


# -----------------------------
# MERGE RESULTS
# -----------------------------
def merge_status(rule_status, ai_status):

    if rule_status == "fail" or ai_status == "fail":
        return "fail"

    if rule_status == "warning" or ai_status == "warning":
        return "warning"

    return "pass"


# -----------------------------
# MAIN COMPLIANCE FUNCTION
# -----------------------------
def validate_claims(content, approved_claims):

    # RULE CHECKS
    claim_integrity_rule = validate_claim_integrity(content, approved_claims)
    off_label_rule = check_off_label(content)
    fair_balance_rule = detect_safety_language(content)

    # AI REVIEW
    ai_report = llm_compliance_review(content, approved_claims)

    # MERGE RESULTS
    claim_integrity = merge_status(claim_integrity_rule, ai_report["claim_integrity"])
    off_label_risk = merge_status(off_label_rule, ai_report["off_label_risk"])
    fair_balance = merge_status(fair_balance_rule, ai_report["fair_balance"])

    citation_check = ai_report["citation_check"]

    return {

        "claim_integrity": {
            "status": claim_integrity,
            "reason": "Approved claims were correctly used in the generated content."
            if claim_integrity == "pass"
            else "One or more approved claims were not clearly reflected in the generated content."
        },

        "citation_check": {
            "status": citation_check,
            "reason": "Claims appear supported by referenced clinical studies."
            if citation_check == "pass"
            else "The content includes claims that may lack clear supporting citations."
        },

        "fair_balance": {
            "status": fair_balance,
            "reason": "Benefit and safety considerations appear balanced."
            if fair_balance == "pass"
            else "The content emphasizes benefits without corresponding safety context."
        },

        "off_label_risk": {
            "status": off_label_risk,
            "reason": "No off-label indications were detected."
            if off_label_risk == "pass"
            else "Content may reference a cancer type not approved for this therapy."
        }
    }