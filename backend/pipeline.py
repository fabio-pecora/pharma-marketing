import os
from openai import OpenAI

from claims_service import get_claims_by_ids
from content_service import create_project, store_version
from compliance_service import validate_claims
from database import get_connection
import json

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ----------------------------------------------------
# GENERATE INITIAL CONTENT
# ----------------------------------------------------
def generate_project_content(content_type, audience, goal, tone, therapeutic_area, claim_ids):

    project_id = create_project(content_type, audience, goal, tone, therapeutic_area)
    yield f"__PROJECT_ID__:{project_id}\n"

    claims = get_claims_by_ids(claim_ids)

    claims_text = "\n".join(
        [f"- {c['claim_text']} ({c['citation']})" for c in claims]
    )

    if content_type == "email":
        format_rules = """
Generate ONLY an EMAIL.

FORMAT

SUBJECT:
<subject line>

BODY:
<email body>
"""
    elif content_type == "social":
        format_rules = """
Generate ONLY a SOCIAL MEDIA POST.

FORMAT

POST:
<post text>

HASHTAGS:
<space separated hashtags>
"""
    elif content_type == "website":
        format_rules = """
Generate ONLY WEBSITE COPY.

FORMAT

TITLE:
<title>

BODY:
<website copy>
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
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.4,
        messages=[
            {"role": "system", "content": "You generate compliant pharmaceutical marketing content."},
            {"role": "user", "content": prompt}
        ],
        stream=True
    )

    generated_text = ""

    for chunk in response:

        delta = chunk.choices[0].delta

        if delta and delta.content:

            token = delta.content
            generated_text += token

            yield token
    compliance_report = validate_claims(generated_text, claims)

    compliance_passed = all(
        v["status"] != "fail" for v in compliance_report.values()
    )

    # store version
    store_version(project_id, 1, generated_text, compliance_passed)

    # ---------------------------------------------
    # STORE METADATA (for compliance UI)
    # ---------------------------------------------
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO project_metadata (project_id, compliance_report, claims_used)
        VALUES (%s, %s, %s)
        """,
        (
            project_id,
            json.dumps(compliance_report),
            json.dumps(claims)
        )
    )

    conn.commit()
    cur.close()
    conn.close()


# ----------------------------------------------------
# REFINEMENT POLICY GUARDRAIL (LLM)
# ----------------------------------------------------
def check_refinement_policy(instruction, refine_type):

    prompt = f"""
You enforce compliance rules for a pharmaceutical marketing AI system.

USER INSTRUCTION:
{instruction}

REFINEMENT TYPE:
{refine_type}

Approved clinical claims MUST remain present.

BLOCK instructions that:
- remove claims
- remove clinical study references
- drastically shorten content so claims disappear
- summarize to extreme brevity (e.g. "5 words")

Respond ONLY:

BLOCK
or
ALLOW
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": "You enforce pharmaceutical compliance policies."},
            {"role": "user", "content": prompt}
        ]
    )

    decision = response.choices[0].message.content.strip().upper()

    if "BLOCK" in decision:
        raise ValueError(
            "Refinement rejected: the instruction would remove approved clinical claims."
        )


# ----------------------------------------------------
# CLAIM PRESERVATION CHECK (RULE SAFETY)
# ----------------------------------------------------
def validate_claim_preservation(refined_content, claims):

    refined = refined_content.lower()

    for claim in claims:

        claim_text = claim["claim_text"].lower()

        # extract anchor keywords
        keywords = claim_text.split()[:6]

        matches = sum(1 for k in keywords if k in refined)

        # allow paraphrasing but ensure some anchors remain
        if matches < max(2, len(keywords)//2):

            raise ValueError(
                f"Refinement removed or significantly altered an approved claim: '{claim['claim_text']}'. "
                "Approved claims must remain represented in the content."
            )

    return True


# ----------------------------------------------------
# REFINE GENERATED CONTENT
# ----------------------------------------------------


def refine_generated_content(project_id, content, refine_type, instruction, claims):

    # STEP 1: policy guardrail (only if claims exist)
    if claims:
        check_refinement_policy(instruction, refine_type)

    refine_map = {
        "Shorten": "Shorten the content while preserving claims.",
        "Expand": "Expand the explanation.",
        "Reorganize": "Reorganize the structure for clarity.",
        "Emphasize Claim": "Emphasize the key clinical claim.",
        "Simplify": "Simplify the language.",
        "Improve Readability": "Improve readability and flow."
    }

    refine_instruction = refine_map.get(refine_type, "")

    claims_text = "\n".join(
        [f"- {c['claim_text']} ({c['citation']})" for c in claims]
    )

    if claims:

        prompt = f"""
    You are refining pharmaceutical marketing content.

    You MUST keep the content compliant with the approved claims.

    You may:
    - improve clarity
    - simplify language
    - reorganize structure
    - shorten moderately

    You may NOT:
    - remove approved claims
    - remove clinical study references
    - introduce new claims

    APPROVED CLAIMS
    {claims_text}

    REFINEMENT GOAL
    {refine_instruction}

    USER INSTRUCTION
    {instruction}

    CURRENT CONTENT
    {content}

    Return ONLY the refined content.
    """

    else:

        prompt = f"""
You are drafting an internal email to the MLR team requesting review or development of an approved claim.

This is NOT marketing content. It is a professional internal request.

IMPORTANT
The user instruction below MUST be incorporated explicitly into the email.

If the user references a specific claim, medication, risk, or identifier,
you MUST clearly mention it in the body of the email.

USER REQUEST
{instruction}

CURRENT EMAIL
{content}

Rewrite the email while preserving the professional tone.

The request described by the user must appear clearly in the email.

Return ONLY the email in this format:

SUBJECT:
<subject>

BODY:
<body>
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        messages=[
            {"role": "system", "content": "You refine compliant pharmaceutical marketing content."},
            {"role": "user", "content": prompt}
        ]
    )

    refined_text = response.choices[0].message.content

    # STEP 2: ensure claims still exist (only if claims exist)
    if claims:
        validate_claim_preservation(refined_text, claims)

    # STEP 3: compliance review (only if claims exist)
    compliance_report = None
    if claims:
        compliance_report = validate_claims(refined_text, claims)

    # STEP 4: STORE NEW VERSION ONLY IF PROJECT EXISTS
    if project_id:

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
        SELECT MAX(version_number)
        FROM content_versions
        WHERE project_id = %s
        """, (project_id,))

        last_version = cur.fetchone()[0] or 1
        new_version = last_version + 1

        cur.close()
        conn.close()

        store_version(project_id, new_version, refined_text, True)

    return {
        "html": refined_text,
        "compliance_report": compliance_report
    }

# ----------------------------------------------------
# CLAIM REQUEST EMAIL
# ----------------------------------------------------
def generate_claim_request_email(audience, category, therapeutic_area):

    prompt = f"""
You are assisting a pharmaceutical marketing team.

No approved claims were found.

Audience: {audience}
Category: {category}
Therapeutic Area: {therapeutic_area}

Write a professional email requesting the MLR team to review whether
an approved claim exists or could be developed.

FORMAT

SUBJECT:
<subject>

BODY:
<email>
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        messages=[
            {"role": "system", "content": "You assist pharma teams with compliant communication."},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content