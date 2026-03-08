from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import ClaimSelectionRequest
from claims_service import get_recommended_claims
from pipeline import generate_project_content

app = FastAPI()

# Allow frontend (Next.js) to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/recommended-claims")
def recommended_claims(audience: str):
    claims = get_recommended_claims(audience)
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