from pydantic import BaseModel
from typing import List, Optional


class ClaimSelectionRequest(BaseModel):
    content_type: str
    audience: str
    goal: str
    tone: str
    therapeutic_area: str
    claim_ids: List[int]
    brand_colors: List[str] = []

class RefineRequest(BaseModel):
    project_id: Optional[int] = None
    content: str
    refine_type: Optional[str] = ""
    instruction: Optional[str] = ""
    claim_ids: List[int] = []


class ClaimRequestEmail(BaseModel):
    audience: str
    category: str
    therapeutic_area: str

class ConversationRequest(BaseModel):
    message: str
    conversation_history: List[str]