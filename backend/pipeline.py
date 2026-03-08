from openai import OpenAI
from config import OPENAI_API_KEY

from claims_service import get_claims_by_ids
from content_service import create_project, store_version
from compliance_service import validate_claims

client = OpenAI(api_key=OPENAI_API_KEY)


def generate_project_content(content_type, audience, goal, tone, therapeutic_area, claim_ids):

    # create project in DB
    project_id = create_project(
        content_type,
        audience,
        goal,
        tone,
        therapeutic_area
    )

    # retrieve selected claims
    claims = get_claims_by_ids(claim_ids)

    claims_text = "\n".join([
        f'{c["claim_text"]} ({c["citation"]})'
        for c in claims
    ])

    prompt = f"""
You are generating FDA-compliant pharmaceutical marketing content.

You MUST only use the approved claims listed below.

Approved Claims:
{claims_text}

Content Type: {content_type}
Audience: {audience}
Goal: {goal}
Tone: {tone}

Generate compliant marketing content using only the claims provided.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.choices[0].message.content

    # compliance check (does not crash API anymore)
    compliance_ok = validate_claims(content, claims)

    html_output = f"<html><body><p>{content}</p></body></html>"

    # store version in DB
    store_version(project_id, 1, content, html_output)

    return {
        "project_id": project_id,
        "content": content,
        "html": html_output,
        "claims_used": claims,
        "compliance_status": "passed" if compliance_ok else "review_required"
    }