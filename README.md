# FRUZAQLA Marketing Content Generator

AI-assisted system for generating **compliant pharmaceutical marketing content** grounded in approved clinical claims.

This prototype demonstrates how Large Language Models can be safely integrated into regulated marketing workflows by:

- grounding generation in approved clinical claims
- validating outputs through compliance checks
- tracking version history of content
- exporting traceable marketing assets

---

# System Overview

Pharmaceutical marketing content must comply with strict regulatory guidelines. Claims used in marketing materials must be supported by approved clinical evidence and must not introduce misleading or off-label information.

This system assists marketing teams by combining **AI generation with compliance guardrails**.

Main capabilities:

- retrieve approved clinical claims
- generate marketing content grounded in those claims
- refine generated content safely
- validate compliance
- track version history
- export marketing assets with traceable metadata

---

# System Architecture

                                      ┌───────────────────────────┐
                                      │        Frontend UI        │
                                      │        (Next.js)          │
                                      │                           │
                                      │ Claim Selection           │
                                      │ Content Generation        │
                                      │ Refinement UI             │
                                      │ Compliance Display        │
                                      └─────────────┬─────────────┘
                                                    │
                                                    │ REST API
                                                    ▼
                                      ┌───────────────────────────┐
                                      │         FastAPI API       │
                                      │                           │
                                      │ /recommended-claims       │
                                      │ /generate-content         │
                                      │ /refine-content           │
                                      │ /draft-claim-request      │
                                      └─────────────┬─────────────┘
                                                    │
                                                    │
                                  ┌─────────────────┼────────────────────┐
                                  ▼                 ▼                    ▼
                      
                       ┌───────────────┐   ┌──────────────────┐   ┌─────────────────┐
                       │ PostgreSQL DB │   │   LLM Pipeline   │   │ Compliance Layer│
                       │               │   │                  │   │                 │
                       │ Claims        │   │ Prompt Builder   │   │ Claim Integrity │
                       │ Projects      │   │ Content Gen      │   │ Citation Check  │
                       │ Versions      │   │ Refinement       │   │ Fair Balance    │
                       │               │   │                  │   │ Off-label Risk  │
                       └───────────────┘   └──────────────────┘   └─────────────────┘
---

# Technology Stack

| Layer    |    Technology   |              Purpose              |
|----------|-----------------|-----------------------------------|
| Frontend | Next.js + React |     Interactive user interface    |
| Backend  |     FastAPI     | API and AI pipeline orchestration |
| Database |    PostgreSQL   | Store claims and content versions |
|    AI    |    OpenAI API   |        Content generation         |
| Styling  |   Tailwind CSS  |             UI styling            |

---

# Project Structure

 project/
│
├── backend/
│
│   ├── app.py
│   ├── pipeline.py
│   ├── database.py
│   ├── config.py
│   ├── models.py
│   │
│   ├── services/
│   │     ├── claims_service.py
│   │     ├── content_service.py
│   │     └── compliance_service.py
│
├── frontend/
│
│   ├── app/
│   │     ├── page.tsx
│   │     └── layout.tsx
│   │
│   └── styles/
│
└── README.md


# Database Schema

The system uses PostgreSQL to store approved claims and track generated content.

Three main tables support the application.

---

## Claims Table

Stores the approved clinical claims used in marketing content.

claims
-------------------------------------
id  
claim_text  
citation  
category  
therapeutic_area  

Example:

1 | Fruzaqla demonstrated improved progression-free survival | FRESCO-2 Trial | efficacy | oncology

---

## Projects Table

Represents a content generation session.

Each project stores the parameters used for generation.

projects
-------------------------------------
id  
content_type  
audience  
goal  
tone  
therapeutic_area  
created_at  

Example:

6 | email | HCP | education | clinical | oncology | 2026-03-10

---

## Content Versions Table

Tracks the evolution of generated content.

Every generation or refinement creates a new version linked to a project.

content_versions
-------------------------------------
id  
project_id  
version_number  
content_text  
created_at  

Example:

project_id | version_number  
6          | 1  
6          | 2  
6          | 3  

This structure allows the system to maintain a full history of how content evolves through refinements.

## Database Entity Relationship

The system uses three core entities to support claim retrieval, content generation, and version tracking.

+-----------------+
|     CLAIMS      |
+-----------------+
| id              |
| claim_text      |
| citation        |
| category        |
| therapeutic_area|
+-----------------+
        |
        | used during generation
        |
        ▼

+-----------------+
|    PROJECTS     |
+-----------------+
| id              |
| content_type    |
| audience        |
| goal            |
| tone            |
| therapeutic_area|
| created_at      |
+-----------------+
        |
        | 1 project
        | can generate
        | multiple versions
        ▼

+----------------------+
|   CONTENT_VERSIONS   |
+----------------------+
| id                   |
| project_id (FK)      |
| version_number       |
| content_text         |
| created_at           |
+----------------------+

---

# Content Generation Pipeline

The system generates marketing content using a controlled AI pipeline.

Workflow:

User selects approved claims  
        │
        ▼
Claims retrieved from database  
        │
        ▼
Extra Selection of content from User
        │
        ▼
Prompt constructed with approved claims  
        │
        ▼
LLM generates marketing content  
        │
        ▼
Compliance validation pipeline  
        │
        ▼
Content stored as a new version  
        │
        ▼
User can refine or export content

---

# Compliance Validation

Generated content is evaluated by a compliance validation layer.

The system checks:

- Claim Integrity
- Citation Presence
- Fair Balance
- Off-Label Risk

Each check returns a structured result:

{
  "status": "pass | warning | fail",
  "reason": "Explanation of the evaluation"
}

---

# Content Refinement

Users can iteratively refine generated content.

Supported refinement actions:

- Shorten
- Expand
- Reorganize
- Emphasize Claim
- Simplify
- Improve Readability

Users may also provide custom instructions.

Before refinement, the system validates instructions to prevent removal of approved claims.

After refinement, the system verifies that the meaning of the claims is preserved.

---

# Export

Generated content can be exported as a styled HTML asset.

Exports include:

- generated marketing content
- approved claims used
- claim citations
- generation metadata
- version information

Example metadata included in export:

Project ID  
Audience  
Content Type  
Marketing Goal  
Tone  
Therapeutic Area  
Version Number  
Export Timestamp

This ensures traceability of generated marketing materials.


---

# Running the Project

## Backend

Install dependencies

pip install fastapi uvicorn psycopg2 openai

Run server

uvicorn app:app --reload

---

## Frontend

Install dependencies

npm install

Run development server

npm run dev

---

# Environment Variables

Create a `.env` file with the following variables:

DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres  
OPENAI_API_KEY=your_api_key


---

# Future Improvements

Potential extensions include:

- RAG-based claim retrieval using embeddings
- visual asset library for approved images
- real-time collaborative editing
- user authentication and permissions
- full compliance audit trail





