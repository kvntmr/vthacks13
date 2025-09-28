"""
Unified File Processing API
Handles file uploads, parsing, and property data extraction
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import tempfile
import os
from pathlib import Path

from app.services.file_router import FileRouter, FileType
from app.services.property_extraction_agent import PropertyExtractionAgent

router = APIRouter(prefix="/files", tags=["file-processing"])

# Initialize services
file_router = FileRouter()
property_agent = PropertyExtractionAgent()

# Request/Response Models
class FileProcessingRequest(BaseModel):
    file_path: str = Field(..., description="Path to the file to process")
    extract_property_data: bool = Field(True, description="Whether to extract property data from text")

class FileProcessingResponse(BaseModel):
    success: bool
    file_info: Optional[Dict[str, Any]] = None
    parsed_content: Optional[Dict[str, Any]] = None
    extracted_property_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class FileUploadResponse(BaseModel):
    success: bool
    file_info: Optional[Dict[str, Any]] = None
    parsed_content: Optional[Dict[str, Any]] = None
    extracted_property_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.get("/health")
async def health_check():
    """Health check endpoint for file processing service"""
    return {
        "status": "healthy",
        "service": "file_processing",
        "supported_formats": file_router.get_supported_formats(),
        "parser_status": file_router.get_parser_status(),
        "ai_agent_available": True,
        "screener_available": False
    }

@router.post("/process-file", response_model=FileProcessingResponse)
async def process_file(request: FileProcessingRequest):
    """
    Process a file from file path
    
    Args:
        request: FileProcessingRequest containing file path and options
        
    Returns:
        FileProcessingResponse with processing results
    """
    try:
        # Validate file exists
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
        
        filename = Path(request.file_path).name
        
        # Check if file type is supported
        if not file_router.is_supported(filename):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {filename}. Supported formats: {file_router.get_supported_formats()}"
            )
        
        # Process the file
        result = await _process_file_pipeline(
            file_path=request.file_path,
            filename=filename,
            extract_property_data=request.extract_property_data
        )
        
        return FileProcessingResponse(
            success=True,
            **result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@router.post("/process-upload", response_model=FileUploadResponse)
async def process_upload(
    file: UploadFile = File(..., description="File to process"),
    extract_property_data: bool = Form(True, description="Whether to extract property data from text"),
):
    """
    Process an uploaded file
    
    Args:
        file: Uploaded file
        extract_property_data: Whether to extract property data from text
        
    Returns:
        FileUploadResponse with processing results
    """
    try:
        # Check if file type is supported
        if not file_router.is_supported(file.filename):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file.filename}. Supported formats: {file_router.get_supported_formats()}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Process the file
        result = await _process_file_content_pipeline(
            file_content=file_content,
            filename=file.filename,
            extract_property_data=extract_property_data
        )
        
        return FileUploadResponse(
            success=True,
            **result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported file formats"""
    return {
        "supported_formats": file_router.get_supported_formats(),
        "parser_status": file_router.get_parser_status(),
        "description": "Supported file formats for processing"
    }

@router.get("/sample-workflow")
async def get_sample_workflow():
    """Get sample workflow demonstration"""
    return {
        "workflow": {
            "step_1": "Upload a PowerPoint file with property information",
            "step_2": "File is automatically routed to PowerPoint parser",
            "step_3": "Text is extracted from slides and images (OCR)",
            "step_4": "AI agent extracts structured property data from text",
            "step_5": "Property data extraction complete",
            "step_6": "Complete investment summary is generated"
        },
        "example_endpoints": {
            "upload_file": "POST /api/v1/files/process-upload",
            "process_file": "POST /api/v1/files/process-file",
            "check_health": "GET /api/v1/files/health"
        }
    }

async def _process_file_pipeline(
    file_path: str,
    filename: str,
    extract_property_data: bool = True,
    run_screener: bool = True
) -> Dict[str, Any]:
    """Process file through the complete pipeline"""
    
    result = {
        "file_info": {},
        "parsed_content": None,
        "extracted_property_data": None,
    }
    
    # Step 1: File information
    file_type = file_router.get_file_type(filename)
    result["file_info"] = {
        "filename": filename,
        "file_type": file_type,
        "file_path": file_path,
        "supported": file_router.is_supported(filename)
    }
    
    # Step 2: Parse file content
    try:
        parsed_content = await file_router.parse_file(file_path, filename)
        result["parsed_content"] = parsed_content
    except Exception as e:
        raise Exception(f"Failed to parse file: {str(e)}")
    
    # Step 3: Extract property data (if requested)
    if extract_property_data and parsed_content:
        try:
            # Extract text from parsed content
            extracted_text = _extract_text_from_parsed_content(parsed_content)
            
            if extracted_text:
                # Use AI agent to extract property data
                property_data = await property_agent.extract_property_data(extracted_text)
                result["extracted_property_data"] = property_data
                
                        
        except Exception as e:
            result["extracted_property_data"] = {"error": f"Failed to extract property data: {str(e)}"}
    
    return result

async def _process_file_content_pipeline(
    file_content: bytes,
    filename: str,
    extract_property_data: bool = True,
    run_screener: bool = True
) -> Dict[str, Any]:
    """Process file content through the complete pipeline"""
    
    result = {
        "file_info": {},
        "parsed_content": None,
        "extracted_property_data": None,
    }
    
    # Step 1: File information
    file_type = file_router.get_file_type(filename)
    result["file_info"] = {
        "filename": filename,
        "file_type": file_type,
        "file_size": len(file_content),
        "supported": file_router.is_supported(filename)
    }
    
    # Step 2: Parse file content
    try:
        parsed_content = await file_router.parse_file_from_bytes(file_content, filename)
        result["parsed_content"] = parsed_content
    except Exception as e:
        raise Exception(f"Failed to parse file: {str(e)}")
    
    # Step 3: Extract property data (if requested)
    if extract_property_data and parsed_content:
        try:
            # Extract text from parsed content
            extracted_text = _extract_text_from_parsed_content(parsed_content)
            
            if extracted_text:
                # Use AI agent to extract property data
                property_data = await property_agent.extract_property_data(extracted_text)
                result["extracted_property_data"] = property_data
                
                        
        except Exception as e:
            result["extracted_property_data"] = {"error": f"Failed to extract property data: {str(e)}"}
    
    return result

def _extract_text_from_parsed_content(parsed_content: Dict[str, Any]) -> str:
    """Extract text content from parsed file content"""
    
    text_parts = []
    
    # Handle PowerPoint content
    if "slides" in parsed_content:
        for slide in parsed_content["slides"]:
            if "slide_text" in slide and slide["slide_text"]:
                text_parts.append(slide["slide_text"])
    
    # Handle general text content
    if "extracted_text" in parsed_content:
        text_parts.append(parsed_content["extracted_text"])
    
    # Handle file metadata
    if "file_name" in parsed_content:
        text_parts.append(f"File: {parsed_content['file_name']}")
    
    # Combine all text
    combined_text = "\n\n".join(text_parts)
    
    return combined_text.strip()
