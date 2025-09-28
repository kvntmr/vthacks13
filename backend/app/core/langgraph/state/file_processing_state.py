"""
State definitions for file processing workflow
"""

from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime
from enum import Enum

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    EXTRACTING = "extracting"
    STORING = "storing"
    COMPLETED = "completed"
    FAILED = "failed"

class FileProcessingState(TypedDict):
    """State for file processing workflow"""
    
    # Input data
    file_content: bytes
    filename: str
    file_path: Optional[str]
    
    # Processing status
    status: ProcessingStatus
    error_message: Optional[str]
    
    # File information
    file_type: str
    file_size: int
    supported: bool
    
    # Parsed content
    parsed_content: Optional[Dict[str, Any]]
    extracted_text: Optional[str]
    
    # AI processing
    extracted_property_data: Optional[Dict[str, Any]]
    
    # Memory storage
    document_id: Optional[str]
    stored_successfully: bool
    
    # Metadata
    processing_start_time: datetime
    processing_end_time: Optional[datetime]
    processing_duration_seconds: Optional[float]

