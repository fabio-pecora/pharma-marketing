from pydantic import BaseModel
from typing import List


class ClaimSelectionRequest(BaseModel):
    content_type: str
    audience: str
    goal: str
    tone: str
    therapeutic_area: str
    claim_ids: List[int]


class RefineRequest(BaseModel):
    content: str
    refine_type: str
    instruction: str
    claim_ids: List[int]


class ClaimRequestEmail(BaseModel):
    audience: str
    category: str
    therapeutic_area: str