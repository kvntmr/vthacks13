from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class StandardDocument(BaseModel):
    """Schema for standard document information"""
    filename: str
    full_name: str
    file_path: str
    file_size: int
    last_modified: datetime
    standard_type: str  # "government" or "industry"


class StandardDocumentList(BaseModel):
    """Schema for list of standard documents"""
    documents: List[StandardDocument]
    total_count: int
    standard_type: str


class StandardInfo(BaseModel):
    """Schema for standard information"""
    id: str
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    category: str  # "government" or "industry"
    requirements_count: Optional[int] = None
    last_updated: Optional[datetime] = None
