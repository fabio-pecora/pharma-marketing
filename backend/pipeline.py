import os
from openai import OpenAI

from claims_service import get_claims_by_ids
from content_service import create_project, store_version
from compliance_service import validate_claims

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_project_content(content_type, audience, goal, tone, therapeutic_area, claim_ids):

    project_id = create_project(content_type, audience, goal, tone, therapeutic_area)

    claims = get_claims_by_ids(claim_ids)

    claims_text = "\n".join(
        [f"- {c['claim_text']} ({c['citation']})" for c in claims]
    )

    # FORMAT RULES BASED ON CONTENT TYPE
    if content_type == "email":

        format_rules = """
Generate ONLY an EMAIL.

FORMAT

SUBJECT:
<subject line>

BODY:
<email body>

Do NOT generate social media or website content.
"""

    elif content_type == "social":

        format_rules = """
Generate ONLY a SOCIAL MEDIA POST.

FORMAT

POST:
<post text>

HASHTAGS:
<space separated hashtags>

Do NOT generate email or website content.
"""

    elif content_type == "website":

        format_rules = """
Generate ONLY WEBSITE COPY.

FORMAT

TITLE:
<title>

BODY:
<website copy>

Do NOT generate email or social content.
"""

    else:
        format_rules = ""

    prompt = f"""
You are generating pharmaceutical marketing content.

IMPORTANT COMPLIANCE RULES

You MUST only use the following APPROVED CLAIMS as factual sources.
You may paraphrase them but you must NOT invent new medical claims.

You may:

- rephrase claims naturally
- adapt language to the audience
- adjust tone
- reorganize the content
- expand explanations

You may NOT:

- invent new clinical results
- introduce claims not listed below
- contradict the approved claims

APPROVED CLAIMS
{claims_text}

CONTENT TYPE: {content_type}
AUDIENCE: {audience}
GOAL: {goal}
TONE: {tone}

{format_rules}

Return ONLY the requested format.
Do not include markdown.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You generate compliant pharma marketing content."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    generated_text = response.choices[0].message.content

    try:
        compliance_report = validate_claims(generated_text, claims)
        compliance_passed = all(
            v != "fail" for v in compliance_report.values()
        )

    except ValueError as e:
        return {
            "error": str(e)
        }

    store_version(
        project_id,
        1,
        generated_text,
        compliance_passed
    )

    return {
        "html": generated_text,
        "compliance_passed": compliance_passed,
        "compliance_report": compliance_report,
        "project_id": project_id,
        "claims_used": claims
    }


def refine_generated_content(content, refine_type, instruction, claims):

    refine_map = {
        "shorten": "Shorten the content while preserving the claims.",
        "expand": "Expand the explanation with more context.",
        "reorganize": "Reorganize the structure for clarity.",
        "emphasize": "Emphasize the key clinical claim.",
        "simplify": "Simplify the language.",
        "readability": "Improve readability and flow."
    }

    refine_instruction = refine_map.get(refine_type, "")

    claims_text = "\n".join(
        [f"- {c['claim_text']} ({c['citation']})" for c in claims]
    )

    prompt = f"""
You are refining pharmaceutical marketing content.

You MUST keep the content compliant with the approved claims.

You may:

- improve clarity
- improve structure
- simplify language
- shorten or expand explanations

You may NOT introduce new claims.

APPROVED CLAIMS
{claims_text}

REFINEMENT GOAL
{refine_instruction}

OPTIONAL USER INSTRUCTION
{instruction}

CURRENT CONTENT
{content}

Return the FULL refined content.
Do not add explanations.
Return plain text only.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You refine compliant pharmaceutical marketing content."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    refined_text = response.choices[0].message.content

    validate_claims(refined_text, claims)

    return refined_text


def generate_claim_request_email(audience, category, therapeutic_area):

    prompt = f"""
You are assisting a pharmaceutical marketing team.

No approved claims were found in the claims library for the following request.

Audience: {audience}
Category: {category}
Therapeutic Area: {therapeutic_area}

Write a professional email requesting the Medical / Legal / Regulatory (MLR) team
to review whether an approved claim exists or could be developed.

The email should:

- be professional
- clearly explain the request
- NOT suggest medical claims
- simply request review or guidance

FORMAT

SUBJECT:
<subject line>

BODY:
<email body>

IMPORTANT:
Return plain text only.
Do not use markdown.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You assist pharma teams with compliant communication."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content