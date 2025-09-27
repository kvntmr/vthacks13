from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.core.models.schemas import StandardDocumentList, StandardDocument
from app.services.compliance_service import ComplianceService

router = APIRouter(prefix="/standards", tags=["standards"])

# Initialize compliance service
compliance_service = ComplianceService()


@router.get("/", response_model=StandardDocumentList)
async def get_standards(
    standard_type: str = Query("government", description="Type of standards: 'government' or 'industry'")
):
    """
    Get list of available compliance standards
    
    Args:
        standard_type: Type of standards to retrieve ("government" or "industry")
        
    Returns:
        List of standard documents with metadata
    """
    try:
        if standard_type not in ["government", "industry"]:
            raise HTTPException(
                status_code=400, 
                detail="standard_type must be 'government' or 'industry'"
            )
        
        documents = compliance_service.get_standard_documents(standard_type)
        return documents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/government", response_model=StandardDocumentList)
async def get_government_standards():
    """
    Get list of government compliance standards
    
    Returns:
        List of government standard documents
    """
    try:
        documents = compliance_service.get_standard_documents("government")
        return documents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/industry", response_model=StandardDocumentList)
async def get_industry_standards():
    """
    Get list of industry compliance standards
    
    Returns:
        List of industry standard documents
    """
    try:
        documents = compliance_service.get_standard_documents("industry")
        return documents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{filename}", response_model=StandardDocument)
async def get_standard_by_filename(
    filename: str,
    standard_type: str = Query("government", description="Type of standards: 'government' or 'industry'")
):
    """
    Get specific standard document information by filename
    
    Args:
        filename: The filename of the standard (with or without .pdf extension)
        standard_type: Type of standards ("government" or "industry")
        
    Returns:
        Standard document information
    """
    try:
        if standard_type not in ["government", "industry"]:
            raise HTTPException(
                status_code=400, 
                detail="standard_type must be 'government' or 'industry'"
            )
        
        document = compliance_service.get_document_by_filename(filename, standard_type)
        return document
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
