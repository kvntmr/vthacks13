"""
Simple Screener API
Provides basic property screening functionality
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, List

from app.services.simple_screener import SimpleScreener

router = APIRouter(prefix="/screener", tags=["screener"])

# Initialize screener service
screener_service = SimpleScreener()

# Request/Response Models
class TextInput(BaseModel):
    text: str = Field(..., description="Text content from a file")
    source: str = Field(..., description="Source identifier (e.g., filename, file type)")

class ScreenerRequest(BaseModel):
    text: str = Field(..., description="Raw text from PowerPoint or other source to analyze")

class MultiScreenerRequest(BaseModel):
    text_inputs: List[TextInput] = Field(..., description="List of text inputs from different files/sources")

class ScreenerResponse(BaseModel):
    success: bool
    summary: str
    error: str = None

@router.get("/health")
async def health_check():
    """Health check endpoint for screener service"""
    return {
        "status": "healthy",
        "service": "simple_screener",
        "description": "Basic property screening with AI-generated summaries"
    }

@router.post("/screen", response_model=ScreenerResponse)
async def screen_property(request: ScreenerRequest):
    """
    Screen a property and generate a summary from single text input
    
    Args:
        request: ScreenerRequest with raw text
        
    Returns:
        ScreenerResponse with generated summary
    """
    try:
        # Generate property summary
        summary = await screener_service.screen_property(request.text)
        
        return ScreenerResponse(
            success=True,
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to screen property: {str(e)}"
        )

@router.post("/screen-multiple", response_model=ScreenerResponse)
async def screen_properties(request: MultiScreenerRequest):
    """
    Screen a property and generate a comprehensive summary from multiple text sources
    
    Args:
        request: MultiScreenerRequest with list of text inputs from different files
        
    Returns:
        ScreenerResponse with generated comprehensive summary
    """
    try:
        # Convert to the format expected by the service
        text_inputs = [{"text": input_data.text, "source": input_data.source} for input_data in request.text_inputs]
        
        # Generate comprehensive property summary
        summary = await screener_service.screen_properties(text_inputs)
        
        return ScreenerResponse(
            success=True,
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to screen properties: {str(e)}"
        )

@router.get("/sample-data")
async def get_sample_data():
    """Get sample text for testing"""
    return {
        "sample_text": """
Property: Downtown Office Building
Location: 123 Main Street, New York, NY
Type: Office Building
Purchase Price: $50,000,000
Cap Rate: 6.0%
NOI: $3,000,000
Area: 5,000 sq ft
Occupancy: 95%
Lease Term: 10 years
Tenant: ABC Corporation (A-rated)
Rent: $60/sq ft

This is a prime office building in downtown Manhattan with excellent tenant quality and long-term lease stability.
        """,
        "sample_multiple_inputs": [
            {
                "text": "Property: Downtown Office Building\nLocation: 123 Main Street, New York, NY\nType: Office Building\nPurchase Price: $50,000,000\nCap Rate: 6.0%\nNOI: $3,000,000\nArea: 5,000 sq ft\nOccupancy: 95%\nLease Term: 10 years\nTenant: ABC Corporation (A-rated)\nRent: $60/sq ft",
                "source": "property_details.pdf"
            },
            {
                "text": "Market Analysis:\n- Downtown Manhattan office market showing 3% annual growth\n- Average cap rates in the area: 5.8-6.2%\n- Recent comparable sales: $45-55M for similar properties\n- Transportation access: Excellent (3 subway lines within 2 blocks)\n- Zoning: Commercial office use permitted",
                "source": "market_analysis.docx"
            },
            {
                "text": "Financial Projections:\nYear 1: NOI $3,000,000\nYear 2: NOI $3,090,000 (3% increase)\nYear 3: NOI $3,183,000 (3% increase)\nYear 5: Potential rent increase to $65/sq ft\nYear 10: Lease renewal expected at market rates\nExit Strategy: Hold for 7-10 years, then sell or refinance",
                "source": "financial_model.xlsx"
            }
        ]
    }
