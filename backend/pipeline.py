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
        [f"{c['claim_text']} ({c['citation']})" for c in claims]
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
You are generating compliant pharmaceutical marketing content.

You MUST only use the approved claims listed below.

APPROVED CLAIMS
{claims_text}

CONTENT TYPE: {content_type}
AUDIENCE: {audience}
GOAL: {goal}
TONE: {tone}

{format_rules}

Return ONLY the requested format.
Do not generate other sections.
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

    compliance_passed = validate_claims(generated_text, claims)

    store_version(
        project_id,
        1,
        generated_text,
        compliance_passed
    )

    return {
        "html": generated_text,
        "compliance_passed": compliance_passed,
        "project_id": project_id
    }


def refine_generated_content(content, refine_type, instruction):

    refine_map = {
        "shorten": "Shorten the content while preserving the claims.",
        "expand": "Expand the explanation with more context.",
        "reorganize": "Reorganize the structure for clarity.",
        "emphasize": "Emphasize the key clinical claim.",
        "simplify": "Simplify the language.",
        "readability": "Improve readability and flow."
    }

    refine_instruction = refine_map.get(refine_type, "")

    prompt = f"""
You are refining pharmaceutical marketing content.

REFINEMENT GOAL
{refine_instruction}

OPTIONAL USER INSTRUCTION
{instruction}

CONTENT
{content}

Return the FULL refined content.
Do not add explanations.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You refine pharma marketing content."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    return response.choices[0].message.content