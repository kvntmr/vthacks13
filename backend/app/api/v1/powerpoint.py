"""
PowerPoint Parser API endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import os
import tempfile
from pathlib import Path

from app.services.powerpoint_parser import PowerPointParser

router = APIRouter(prefix="/powerpoint", tags=["powerpoint"])

# Initialize the parser
# Set the TESSDATA_PREFIX environment variable to point to our tessdata directory
tessdata_path = os.path.join(os.path.dirname(__file__), "..", "..", "services", "tessdata")
os.environ["TESSDATA_PREFIX"] = tessdata_path

# Initialize parser (tesseract should be in PATH, so we don't need to specify the executable path)
powerpoint_parser = PowerPointParser(tessdata_path)

# Request/Response Models
class PowerPointParseRequest(BaseModel):
    file_path: str = Field(..., description="Path to the PowerPoint file to parse")

class PowerPointParseResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.get("/health")
async def health_check():
    """Health check endpoint for PowerPoint parser service"""
    return {
        "status": "healthy",
        "service": "powerpoint_parser",
        "supported_formats": powerpoint_parser.get_supported_formats(),
        "ocr_available": True
    }

@router.post("/parse-file", response_model=PowerPointParseResponse)
async def parse_powerpoint_file(request: PowerPointParseRequest):
    """
    Parse a PowerPoint file from a file path
    
    Args:
        request: PowerPointParseRequest containing file path
        
    Returns:
        PowerPointParseResponse with extracted text and metadata
    """
    try:
        # Validate file
        is_valid, error_msg = powerpoint_parser.validate_file(request.file_path)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Parse the file
        result = await powerpoint_parser.parse_powerpoint(request.file_path)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return PowerPointParseResponse(
            success=True,
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PowerPoint file: {str(e)}")

@router.post("/parse-upload", response_model=PowerPointParseResponse)
async def parse_powerpoint_upload(
    file: UploadFile = File(..., description="PowerPoint file to parse")
):
    """
    Parse a PowerPoint file from uploaded file
    
    Args:
        file: Uploaded PowerPoint file
        
    Returns:
        PowerPointParseResponse with extracted text and metadata
    """
    try:
        # Validate file type
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in powerpoint_parser.get_supported_formats():
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format: {file_ext}. Supported formats: {powerpoint_parser.get_supported_formats()}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Parse the file
        result = await powerpoint_parser.parse_powerpoint_from_bytes(file_content, file.filename)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return PowerPointParseResponse(
            success=True,
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse uploaded PowerPoint file: {str(e)}")

@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported PowerPoint file formats"""
    return {
        "supported_formats": powerpoint_parser.get_supported_formats(),
        "description": "Supported PowerPoint file formats for parsing"
    }

@router.post("/validate-file")
async def validate_powerpoint_file(request: PowerPointParseRequest):
    """
    Validate if a file is a supported PowerPoint format
    
    Args:
        request: PowerPointParseRequest containing file path
        
    Returns:
        Validation result
    """
    try:
        is_valid, error_msg = powerpoint_parser.validate_file(request.file_path)
        
        return {
            "file_path": request.file_path,
            "is_valid": is_valid,
            "error_message": error_msg if not is_valid else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate file: {str(e)}")

@router.get("/sample-data")
async def get_sample_data():
    """Get sample PowerPoint parsing result for testing"""
    return {
        "sample_result": {
            "file_path": "sample.pptx",
            "file_name": "sample.pptx",
            "total_slides": 3,
            "slides": [
                {
                    "slide_number": 1,
                    "slide_text": "Welcome to our presentation\nThis is the first slide with text content",
                    "text_boxes": 2,
                    "images_processed": 1,
                    "tables_processed": 0,
                    "shapes_processed": 0,
                    "ocr_used": True
                },
                {
                    "slide_number": 2,
                    "slide_text": "Market Analysis\n• Revenue: $1.2M\n• Growth: 15%\n• Market Share: 8%",
                    "text_boxes": 1,
                    "images_processed": 0,
                    "tables_processed": 1,
                    "shapes_processed": 0,
                    "ocr_used": False
                }
            ],
            "extracted_text": "Welcome to our presentation\nThis is the first slide with text content\nMarket Analysis\n• Revenue: $1.2M\n• Growth: 15%\n• Market Share: 8%",
            "ocr_used": True,
            "processing_summary": {
                "text_boxes": 3,
                "images_processed": 1,
                "tables_processed": 1,
                "shapes_processed": 0
            }
        }
    }
