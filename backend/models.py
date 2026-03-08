from pydantic import BaseModel
from typing import List


class ProjectRequest(BaseModel):
    content_type: str
    audience: str
    goal: str
    tone: str
    therapeutic_area: str


class ClaimSelectionRequest(BaseModel):
    content_type: str
    audience: str
    goal: str
    tone: str
    therapeutic_area: str
    claim_ids: List[int]