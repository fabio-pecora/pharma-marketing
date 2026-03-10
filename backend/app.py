from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List
from fastapi import Query

from models import ClaimSelectionRequest, RefineRequest, ClaimRequestEmail
from pipeline import generate_project_content, refine_generated_content, generate_claim_request_email
from claims_service import get_recommended_claims, get_claims_by_ids

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/recommended-claims")
def recommended_claims(
    categories: List[str] = Query(...),
    therapeutic_area: str = Query(...)
):

    claims = get_recommended_claims(
        categories,
        therapeutic_area
    )

    return claims

@app.post("/generate-content")
def generate_content(request: ClaimSelectionRequest):

    try:

        generator = generate_project_content(
            request.content_type,
            request.audience,
            request.goal,
            request.tone,
            request.therapeutic_area,
            request.claim_ids
        )

        return StreamingResponse(generator, media_type="text/plain")

    except ValueError as e:
        return {"error": str(e)}


@app.post("/refine-content")
def refine_content(request: RefineRequest):

    # If there are claim IDs, retrieve them
    claims = []
    if request.claim_ids:
        claims = get_claims_by_ids(request.claim_ids)

    try:
        result = refine_generated_content(
            request.project_id,
            request.content,
            request.refine_type,
            request.instruction,
            claims
        )

        return result

    except ValueError as e:
        return {
            "error": str(e)
        }


@app.post("/draft-claim-request")
def draft_claim_request(request: ClaimRequestEmail):

    email = generate_claim_request_email(
        request.audience,
        request.category,
        request.therapeutic_area
    )

    return {"email": email}

@app.get("/project-metadata/{project_id}")
def get_project_metadata(project_id: int):

    from database import get_connection

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT compliance_report, claims_used
        FROM project_metadata
        WHERE project_id = %s
    """, (project_id,))

    result = cur.fetchone()

    cur.close()
    conn.close()

    if not result:
        return {}

    return {
        "compliance_report": result[0],
        "claims_used": result[1]
    }