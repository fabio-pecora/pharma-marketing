from fastapi import FastAPI, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import csv
import io
from database import get_connection
from pypdf import PdfReader
from openai import OpenAI
from pdf2image import convert_from_bytes
from visual_assets_service import process_style_guide
import pytesseract

from fastapi.staticfiles import StaticFiles
from models import ClaimSelectionRequest, RefineRequest, ClaimRequestEmail, ConversationRequest
from pipeline import generate_project_content, refine_generated_content, generate_claim_request_email
from claims_service import get_recommended_claims, get_claims_by_ids

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\Users\fabio\Desktop\poppler-25.12.0\Library\bin"

app = FastAPI()
app.mount("/visual_assets", StaticFiles(directory="visual_assets"), name="visual_assets")
client = OpenAI()


ALLOWED_CATEGORIES = [
    "indication",
    "efficacy",
    "safety",
    "dosing"
]

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
        request.claim_ids,
        request.brand_colors
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

def extract_text_with_ocr(file_bytes):

    images = convert_from_bytes(file_bytes, poppler_path=POPPLER_PATH)

    full_text = ""

    for img in images:
        text = pytesseract.image_to_string(img)
        full_text += text + "\n"

    return full_text

def extract_text_from_pdf(file_bytes):

    reader = PdfReader(io.BytesIO(file_bytes))

    full_text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            full_text += page_text + "\n"

    return full_text

def extract_claims_with_llm(text):

        prompt = f"""
    You are analyzing clinical study text.

    Extract clear clinical evidence statements that could be used as marketing claims or clinical facts.

    Each item must contain:

    claim_text
    citation
    category

    Category must be one of:
    indication
    efficacy
    safety
    dosing

    Return ONLY JSON.

    Example:

    [
    {{
        "claim_text": "FRUZAQLA improved progression free survival",
        "citation": "Phase III Trial",
        "category": "efficacy"
    }}
    ]

    Text:
    {text[:12000]}
    """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=[
                {"role": "system", "content": "You extract clinical evidence."},
                {"role": "user", "content": prompt}
            ]
        )

        import json

        raw = response.choices[0].message.content.strip()

        # remove markdown code blocks if present
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            return json.loads(raw)
        except:
            print("LLM returned invalid JSON:", raw)
            return []

@app.post("/upload-claims-file")
async def upload_claims_file(
    file: UploadFile = File(...),
    material_type: str = Form(...)
):

    conn = get_connection()
    cur = conn.cursor()

    contents = await file.read()

    filename = file.filename.lower()

    inserted = 0

    # CSV ingestion
    if filename.endswith(".csv"):

        decoded = contents.decode("utf-8")

        reader = csv.DictReader(io.StringIO(decoded))

        for row in reader:

            cur.execute(
                """
                INSERT INTO claims
                (claim_text, citation, category, therapeutic_area, material_type)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    row.get("claim_text"),
                    row.get("citation"),
                    row.get("category"),
                    row.get("therapeutic_area", "Oncology"),
                    material_type
                )
            )

            inserted += 1


    # PDF ingestion
    elif filename.endswith(".pdf"):

        text = extract_text_from_pdf(contents)

        if not text or len(text.strip()) < 50:
            print("Weak or missing PDF text. Running OCR...")
            text = extract_text_with_ocr(contents)

        print("EXTRACTED TEXT SAMPLE:", text[:500])

        extracted_claims = extract_claims_with_llm(text)

        print("EXTRACTED CLAIMS:", extracted_claims)

        for claim in extracted_claims:

            category = claim.get("category", "").lower().strip()

            if category not in ALLOWED_CATEGORIES:
                continue

            cur.execute(
                """
                INSERT INTO claims
                (claim_text, citation, category, therapeutic_area, material_type)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (
                    claim["claim_text"],
                    claim.get("citation", "Clinical Study"),
                    category,
                    "Oncology",
                    material_type
                )
            )

            inserted += 1

    conn.commit()

    cur.close()
    conn.close()

    return {
        "rows_inserted": inserted
    }

import os

@app.post("/upload-style-guide")
async def upload_style_guide(file: UploadFile = File(...)):

    os.makedirs("uploads", exist_ok=True)

    file_location = f"uploads/{file.filename}"

    with open(file_location, "wb") as buffer:
        buffer.write(await file.read())

    result = process_style_guide(file_location)

    return {
        "detected_assets": result["detected_assets"],
        "brand_colors": result["brand_colors"]
    }

    from models import ConversationRequest
from pipeline import guided_conversation_step

@app.post("/guided-conversation")
def guided_conversation(req: ConversationRequest):

    result = guided_conversation_step(
        req.message,
        req.conversation_history
    )

    return {"response": result}