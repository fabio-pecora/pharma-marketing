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
You are generating pharmaceutical marketing content using approved claims.

CLAIM RULES

All approved claims MUST appear exactly as written.
Do NOT modify the wording of the claims.
Do NOT remove the claims.

Outside of the claims, you are free to:

- rewrite the surrounding content
- change tone and style
- reorganize sections
- expand or shorten explanations
- add neutral contextual information

You may place the claims anywhere in the content.

IMPORTANT:
The claims must appear EXACTLY as written, but the rest of the text can be written freely.

APPROVED CLAIMS
{claims_text}

CONTENT TYPE: {content_type}
AUDIENCE: {audience}
GOAL: {goal}
TONE: {tone}

{format_rules}

Return ONLY the requested format.
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
        validate_claims(generated_text, claims)
        compliance_passed = True

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
        "project_id": project_id
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
        [f"{c['claim_text']} ({c['citation']})" for c in claims]
    )

    prompt = f"""
You are refining pharmaceutical marketing content.

STRICT RULES

1. All approved claims MUST remain EXACTLY as written.
2. Claims may NOT be modified, summarized, paraphrased, or shortened.
3. Claims must appear in the refined content exactly as provided.
4. You may ONLY modify the surrounding text.

REFINEMENT REQUIREMENT

You MUST strictly follow the refinement request.

If the request includes a constraint (example: word limit, shorter content, etc),
you MUST satisfy it ecactly. 

If the request cannot be satisfied because the approved claims themselves exceed
the constraint, return ONLY the following message:

ERROR: The refinement request cannot be satisfied because the approved claims exceed the required constraint.

APPROVED CLAIMS (IMMUTABLE)
---------------------------
{claims_text}
---------------------------

REFINEMENT GOAL
{refine_instruction}

OPTIONAL USER INSTRUCTION
{instruction}

CURRENT CONTENT
{content}

Return the FULL refined content.
Do not add explanations.
Do not add markdown.
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

    # validate that claims were not changed
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
Do NOT use markdown.
Do NOT use ** or headings.
Return plain text only.
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