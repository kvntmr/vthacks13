"""
State definitions for parallel file processing workflow
"""

from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime
from enum import Enum
from dataclasses import dataclass

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AgentType(str, Enum):
    PDF_AGENT = "pdf_agent"
    DOCX_AGENT = "docx_agent"
    PPTX_AGENT = "pptx_agent"
    XLSX_AGENT = "xlsx_agent"
    CSV_AGENT = "csv_agent"
    TXT_AGENT = "txt_agent"
    RTF_AGENT = "rtf_agent"
    ODT_AGENT = "odt_agent"
    GENERAL_AGENT = "general_agent"

@dataclass
class FileProcessingTask:
    """Individual file processing task"""
    task_id: str
    filename: str
    file_content: bytes
    file_type: str
    file_size: int
    agent_type: AgentType
    status: ProcessingStatus
    assigned_agent: Optional[str] = None
    processing_start_time: Optional[datetime] = None
    processing_end_time: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

class ParallelProcessingState(TypedDict):
    """State for parallel file processing workflow"""
    
    # Input data
    files: List[Dict[str, Any]]  # List of file data
    total_files: int
    
    # Processing tasks
    tasks: List[FileProcessingTask]
    completed_tasks: List[FileProcessingTask]
    failed_tasks: List[FileProcessingTask]
    
    # Agent management
    available_agents: Dict[AgentType, List[str]]  # Agent type -> list of agent IDs
    agent_assignments: Dict[str, str]  # task_id -> agent_id
    
    # Processing status
    overall_status: ProcessingStatus
    processing_start_time: datetime
    processing_end_time: Optional[datetime]
    processing_duration_seconds: Optional[float]
    
    # Results
    successful_uploads: int
    failed_uploads: int
    total_documents_stored: int
    errors: List[str]
