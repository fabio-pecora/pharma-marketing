from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
def recommended_claims(category: str, therapeutic_area: str):

    claims = get_recommended_claims(
        category,
        therapeutic_area
    )

    return claims


@app.post("/generate-content")
def generate_content(request: ClaimSelectionRequest):

    try:
        result = generate_project_content(
            request.content_type,
            request.audience,
            request.goal,
            request.tone,
            request.therapeutic_area,
            request.claim_ids
        )

        return result

    except ValueError as e:
        return {
            "error": str(e)
        }


@app.post("/refine-content")
def refine_content(request: RefineRequest):

    claims = get_claims_by_ids(request.claim_ids)

    try:
        refined = refine_generated_content(
            request.content,
            request.refine_type,
            request.instruction,
            claims
        )

        return {
            "html": refined
        }

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

