"""
Memory-based Screening API
Provides screening functionality using documents stored in AI agent memory
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

from app.services.memory_screening_service import MemoryScreeningService
from app.core.langchain.memory.document_memory import DocumentType

router = APIRouter(prefix="/memory-screening", tags=["memory-screening"])

# Initialize screening service
screening_service = MemoryScreeningService()

# Request/Response Models
class DocumentScreeningRequest(BaseModel):
    document_id: str = Field(..., description="ID of the document to screen")
    include_context: bool = Field(True, description="Whether to include related documents for context")

class SearchScreeningRequest(BaseModel):
    search_query: str = Field(..., description="Query to search for relevant documents")
    document_type: Optional[str] = Field(None, description="Filter by document type")
    limit: int = Field(5, description="Maximum number of documents to include")
    include_property_data: bool = Field(True, description="Whether to include documents with property data")

class ComprehensiveScreeningRequest(BaseModel):
    include_property_data_only: bool = Field(True, description="Whether to only include documents with property data")

class ScreeningContextRequest(BaseModel):
    document_id: str = Field(..., description="ID of the main document")
    context_radius: int = Field(3, description="Number of related documents to include")

class ScreeningResponse(BaseModel):
    success: bool
    summary: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ScreeningContextResponse(BaseModel):
    success: bool
    main_document: Optional[Dict[str, Any]] = None
    related_documents: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

@router.get("/health")
async def health_check():
    """Health check endpoint for memory screening service"""
    return {
        "status": "healthy",
        "service": "memory_screening",
        "description": "Screening service using documents from AI agent memory",
        "memory_available": True
    }

@router.post("/screen-document", response_model=ScreeningResponse)
async def screen_document(request: DocumentScreeningRequest):
    """
    Screen a property using a specific document from memory
    
    Args:
        request: DocumentScreeningRequest with document ID and options
        
    Returns:
        ScreeningResponse with property summary
    """
    try:
        result = await screening_service.screen_property_from_memory(
            document_id=request.document_id,
            include_context=request.include_context
        )
        
        if result["success"]:
            return ScreeningResponse(
                success=True,
                summary=result["summary"],
                metadata={
                    "document_id": result["document_id"],
                    "filename": result["filename"],
                    "document_type": result["document_type"],
                    "sources_used": result["sources_used"],
                    "extracted_property_data": result.get("extracted_property_data"),
                    "screening_timestamp": result["screening_timestamp"]
                }
            )
        else:
            return ScreeningResponse(
                success=False,
                error=result["error"]
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to screen document: {str(e)}"
        )

@router.post("/screen-by-search", response_model=ScreeningResponse)
async def screen_by_search(request: SearchScreeningRequest):
    """
    Screen properties by searching for relevant documents in memory
    
    Args:
        request: SearchScreeningRequest with search parameters
        
    Returns:
        ScreeningResponse with property summary
    """
    try:
        # Convert document type string to enum if provided
        document_type = None
        if request.document_type:
            try:
                document_type = DocumentType(request.document_type.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document type: {request.document_type}. Valid types: {[dt.value for dt in DocumentType]}"
                )
        
        result = await screening_service.screen_properties_by_search(
            search_query=request.search_query,
            document_type=document_type,
            limit=request.limit,
            include_property_data=request.include_property_data
        )
        
        if result["success"]:
            return ScreeningResponse(
                success=True,
                summary=result["summary"],
                metadata={
                    "search_query": result["search_query"],
                    "documents_used": result["documents_used"],
                    "document_ids": result["document_ids"],
                    "search_results": result["search_results"],
                    "screening_timestamp": result["screening_timestamp"]
                }
            )
        else:
            return ScreeningResponse(
                success=False,
                error=result["error"]
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to screen by search: {str(e)}"
        )

@router.post("/screen-all", response_model=ScreeningResponse)
async def screen_all_properties(request: ComprehensiveScreeningRequest):
    """
    Screen all properties stored in memory
    
    Args:
        request: ComprehensiveScreeningRequest with options
        
    Returns:
        ScreeningResponse with comprehensive property summary
    """
    try:
        result = await screening_service.screen_all_properties(
            include_property_data_only=request.include_property_data_only
        )
        
        if result["success"]:
            return ScreeningResponse(
                success=True,
                summary=result["summary"],
                metadata={
                    "total_documents": result["total_documents"],
                    "document_ids": result["document_ids"],
                    "screening_timestamp": result["screening_timestamp"]
                }
            )
        else:
            return ScreeningResponse(
                success=False,
                error=result["error"]
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to screen all properties: {str(e)}"
        )

@router.post("/get-context", response_model=ScreeningContextResponse)
async def get_screening_context(request: ScreeningContextRequest):
    """
    Get context for screening by finding related documents
    
    Args:
        request: ScreeningContextRequest with document ID and context radius
        
    Returns:
        ScreeningContextResponse with context information
    """
    try:
        result = await screening_service.get_screening_context(
            document_id=request.document_id,
            context_radius=request.context_radius
        )
        
        if result["success"]:
            return ScreeningContextResponse(
                success=True,
                main_document=result["main_document"],
                related_documents=result["related_documents"]
            )
        else:
            return ScreeningContextResponse(
                success=False,
                error=result["error"]
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get screening context: {str(e)}"
        )

@router.get("/sample-queries")
async def get_sample_queries():
    """Get sample search queries for testing"""
    return {
        "sample_queries": [
            {
                "query": "office building downtown",
                "description": "Search for office buildings in downtown areas"
            },
            {
                "query": "industrial warehouse logistics",
                "description": "Search for industrial and logistics properties"
            },
            {
                "query": "retail shopping center",
                "description": "Search for retail properties and shopping centers"
            },
            {
                "query": "residential apartment complex",
                "description": "Search for residential properties"
            },
            {
                "query": "property investment analysis",
                "description": "Search for investment analysis documents"
            }
        ],
        "document_types": [dt.value for dt in DocumentType],
        "example_endpoints": {
            "screen_document": "POST /api/v1/memory-screening/screen-document",
            "screen_by_search": "POST /api/v1/memory-screening/screen-by-search",
            "screen_all": "POST /api/v1/memory-screening/screen-all",
            "get_context": "POST /api/v1/memory-screening/get-context"
        }
    }

