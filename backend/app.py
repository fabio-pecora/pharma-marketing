from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import ClaimSelectionRequest, RefineRequest
from claims_service import get_recommended_claims
from pipeline import generate_project_content, refine_generated_content

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/recommended-claims")
def recommended_claims(audience: str, category: str, therapeutic_area: str):

    claims = get_recommended_claims(
        audience,
        category,
        therapeutic_area
    )

    return claims


@app.post("/generate-content")
def generate_content(request: ClaimSelectionRequest):

    result = generate_project_content(
        request.content_type,
        request.audience,
        request.goal,
        request.tone,
        request.therapeutic_area,
        request.claim_ids
    )

    return result


@app.post("/refine-content")
def refine_content(request: RefineRequest):

    refined = refine_generated_content(
        request.content,
        request.refine_type,
        request.instruction
    )

    return {"html": refined}