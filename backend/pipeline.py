from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def run_compliance_check(generated_text, approved_claims):
    """
    Check if generated text only contains approved claims
    """

    violations = []

    for sentence in generated_text.split("."):
        sentence = sentence.strip()

        if not sentence:
            continue

        approved = False

        for claim in approved_claims:
            if claim.lower() in sentence.lower():
                approved = True
                break

        if not approved:
            violations.append(sentence)

    if violations:
        return {
            "status": "failed",
            "violations": violations
        }

    return {
        "status": "passed",
        "violations": []
    }


def generate_project_content(
        user_prompt,
        claims,
        audience="HCP",
        content_type="email"
):
    """
    Generate marketing content from approved claims
    """

    approved_claims = [c["claim_text"] for c in claims]

    claims_text = "\n".join([f"- {c}" for c in approved_claims])

    system_prompt = f"""
You are generating pharmaceutical marketing content.

IMPORTANT RULES:
- You MUST only use the approved claims provided.
- Do NOT invent new claims.
- Do NOT paraphrase claims.
- Only reuse the exact claims.

Approved Claims:
{claims_text}

Generate a short {content_type} targeting {audience}.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )

    generated_text = response.choices[0].message.content

    compliance_result = run_compliance_check(
        generated_text,
        approved_claims
    )

    return {
        "generated_text": generated_text,
        "compliance": compliance_result
    }