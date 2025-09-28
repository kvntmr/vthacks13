"""
Unified File Processing API
Handles file uploads, parsing, and storing in AI agent memory
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import os

from app.core.langgraph.workflows.file_processing_workflow import FileProcessingWorkflow
from app.core.langgraph.workflows.parallel_processing_workflow import ParallelProcessingWorkflow
from app.core.langchain.memory.document_memory import DocumentMemory, DocumentType

router = APIRouter(prefix="/files", tags=["file-processing"])

# Initialize services
file_processing_workflow = FileProcessingWorkflow()
parallel_processing_workflow = ParallelProcessingWorkflow()
document_memory = DocumentMemory()

# Request/Response Models
class FileUploadResponse(BaseModel):
    success: bool
    status: str
    error_message: Optional[str] = None
    file_info: Dict[str, Any]
    parsed_content: Optional[Dict[str, Any]] = None
    extracted_property_data: Optional[Dict[str, Any]] = None
    memory_storage: Dict[str, Any]
    processing_info: Dict[str, Any]

class MemorySearchRequest(BaseModel):
    query: str = Field(..., description="Search query for documents")
    document_type: Optional[str] = Field(None, description="Filter by document type")
    limit: int = Field(5, description="Maximum number of results")
    include_property_data: bool = Field(False, description="Whether to include documents with property data")

class MemorySearchResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    total_results: int

class ParallelFileUploadRequest(BaseModel):
    extract_property_data: bool = Field(True, description="Whether to extract property data from files")

class ParallelFileUploadResponse(BaseModel):
    success: bool
    status: str
    total_files: int
    successful_files: int
    failed_files: int
    processing_time: float
    results: List[Dict[str, Any]]
    agent_assignments: Dict[str, str]

class DeleteDocumentsRequest(BaseModel):
    document_ids: List[str] = Field(..., description="List of document IDs to delete")

class DeleteDocumentsResponse(BaseModel):
    success: bool
    deleted_count: int
    deleted_documents: List[str]
    failed_documents: List[Dict[str, Any]]
    message: str

class FolderUploadRequest(BaseModel):
    folder_path: str = Field(..., description="Path to the folder containing files to upload")
    extract_property_data: bool = Field(True, description="Whether to extract property data from files")
    recursive: bool = Field(False, description="Whether to include files from subdirectories")
    file_extensions: Optional[List[str]] = Field(None, description="List of allowed file extensions (e.g., ['.pdf', '.docx'])")

class FolderUploadResponse(BaseModel):
    success: bool
    total_files_found: int
    successful_uploads: int
    failed_uploads: int
    processing_time: float
    results: List[Dict[str, Any]]
    message: str  # filename -> agent_type

@router.get("/health")
async def health_check():
    """Health check endpoint for file processing service"""
    try:
        # Get document memory stats
        memory_stats = await document_memory.get_document_stats()
        
        return {
            "status": "healthy",
            "service": "file_processing",
            "memory_system": {
                "available": True,
                "total_documents": memory_stats["total_documents"],
                "total_size_bytes": memory_stats["total_size_bytes"],
                "documents_by_type": memory_stats["documents_by_type"]
            },
            "workflow_available": True,
            "screening_separated": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "file_processing",
            "error": str(e),
            "memory_system": {
                "available": False
            },
            "workflow_available": False,
            "screening_separated": True
        }

@router.post("/process-upload", response_model=FileUploadResponse)
async def process_upload(
    file: UploadFile = File(..., description="File to process"),
    extract_property_data: bool = Form(True, description="Whether to extract property data from text"),
):
    """
    Process an uploaded file and store in AI agent memory
    
    Args:
        file: Uploaded file
        extract_property_data: Whether to extract property data from text
        
    Returns:
        FileUploadResponse with processing results
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Process the file using the workflow
        result = await file_processing_workflow.process_file(
            file_content=file_content,
            filename=file.filename
        )
        
        # Invalidate AI agent cache since new document was added
        try:
            from app.api.v1.ai_agent import invalidate_document_cache
            invalidate_document_cache()
        except ImportError:
            pass  # AI agent module not available
        
        return FileUploadResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

@router.post("/process-upload-parallel", response_model=ParallelFileUploadResponse)
async def process_upload_parallel(
    files: List[UploadFile] = File(..., description="Multiple files to process in parallel"),
    extract_property_data: bool = Form(True, description="Whether to extract property data from files"),
):
    """
    Process multiple files in parallel using specialized agents
    
    Each file gets assigned to a specialized agent based on its type:
    - PDF files → PDF Agent
    - Excel files → Excel Agent  
    - CSV files → CSV Agent
    - Word docs → DOCX Agent
    - PowerPoint → PPTX Agent
    - Text files → Text Agent
    """
    import time
    start_time = time.time()
    
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        if len(files) > 20:  # Reasonable limit
            raise HTTPException(status_code=400, detail="Too many files. Maximum 20 files per request.")
        
        # Prepare file data for parallel processing
        file_data = []
        for file in files:
            file_content = await file.read()
            file_data.append({
                "filename": file.filename,
                "content": file_content,
                "size": len(file_content)
            })
        
        # Process files in parallel using specialized agents
        result = await parallel_processing_workflow.process_files(
            files=file_data,
            extract_property_data=extract_property_data
        )
        
        # Invalidate AI agent cache since new documents were added
        try:
            from app.api.v1.ai_agent import invalidate_document_cache
            invalidate_document_cache()
        except ImportError:
            pass  # AI agent module not available
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Count successful vs failed files
        successful_files = result.get("successful_uploads", 0)
        failed_files = result.get("failed_uploads", 0)
        
        return ParallelFileUploadResponse(
            success=result.get("success", False),
            status=result.get("overall_status", "unknown"),
            total_files=len(files),
            successful_files=successful_files,
            failed_files=failed_files,
            processing_time=processing_time,
            results=result.get("results", []),
            agent_assignments=result.get("agent_assignments", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parallel file processing failed: {str(e)}")

@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported file formats"""
    from app.services.file_router import FileRouter
    file_router = FileRouter()
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
            "step_1": "Upload a file with property information",
            "step_2": "File is automatically routed to appropriate parser",
            "step_3": "Text is extracted from the document",
            "step_4": "AI agent extracts structured property data from text",
            "step_5": "Document is stored in AI agent memory",
            "step_6": "Document is ready for screening or analysis"
        },
        "example_endpoints": {
            "upload_file": "POST /api/v1/files/process-upload",
            "search_memory": "POST /api/v1/files/memory/search",
            "get_documents": "GET /api/v1/files/memory/documents",
            "check_health": "GET /api/v1/files/health"
        }
    }

@router.post("/memory/search", response_model=MemorySearchResponse)
async def search_memory(request: MemorySearchRequest):
    """
    Search documents in AI agent memory
    
    Args:
        request: MemorySearchRequest with search parameters
        
    Returns:
        MemorySearchResponse with search results
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
        
        # Search documents
        results = await document_memory.search_documents(
            query=request.query,
            document_type=document_type,
            limit=request.limit,
            include_property_data=request.include_property_data
        )
        
        return MemorySearchResponse(
            success=True,
            results=results,
            total_results=len(results)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory search failed: {str(e)}")

@router.get("/memory/documents")
async def get_all_documents(include_property_data: bool = False):
    """
    Get all documents stored in memory
    
    Args:
        include_property_data: Whether to include extracted property data
        
    Returns:
        List of all documents
    """
    try:
        documents = await document_memory.get_all_documents(include_property_data=include_property_data)
        return {
            "success": True,
            "documents": documents,
            "total_count": len(documents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve documents: {str(e)}")

@router.get("/memory/documents/{document_id}")
async def get_document_by_id(document_id: str):
    """
    Get a specific document by ID
    
    Args:
        document_id: Document ID
        
    Returns:
        Document details
    """
    try:
        document = await document_memory.get_document_by_id(document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found")
        
        return {
            "success": True,
            "document": document
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve document: {str(e)}")

@router.delete("/memory/documents/{document_id}")
async def delete_document(document_id: str):
    """
    Delete a document from memory
    
    Args:
        document_id: Document ID to delete
        
    Returns:
        Deletion result
    """
    try:
        success = await document_memory.delete_document(document_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found")
        
        return {
            "success": True,
            "message": f"Document {document_id} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@router.post("/memory/documents/delete-selected")
async def delete_selected_documents(request: DeleteDocumentsRequest):
    """Delete multiple selected documents by their IDs"""
    try:
        if not request.document_ids:
            raise HTTPException(status_code=400, detail="No document IDs provided")
        
        if len(request.document_ids) > 100:  # Reasonable limit
            raise HTTPException(status_code=400, detail="Too many documents. Maximum 100 documents per request.")
        
        result = await document_memory.delete_documents_by_ids(request.document_ids)
        
        # Invalidate AI agent cache since documents were removed
        try:
            from app.api.v1.ai_agent import invalidate_document_cache
            invalidate_document_cache()
        except ImportError:
            pass  # AI agent module not available
        
        return DeleteDocumentsResponse(
            success=result["success"],
            deleted_count=result["deleted_count"],
            deleted_documents=result["deleted_documents"],
            failed_documents=result["failed_documents"],
            message=f"Successfully deleted {result['deleted_count']} documents"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete selected documents: {str(e)}")

@router.delete("/memory/clear-all")
async def clear_all_documents():
    """Clear all documents from memory"""
    try:
        result = await document_memory.clear_all_documents()
        
        # Invalidate AI agent cache since all documents were removed
        try:
            from app.api.v1.ai_agent import invalidate_document_cache
            invalidate_document_cache()
        except ImportError:
            pass  # AI agent module not available
        
        return {
            "success": True,
            "message": "All documents cleared from memory",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear all documents: {str(e)}")

@router.post("/process-folder", response_model=FolderUploadResponse)
async def process_folder(request: FolderUploadRequest):
    """Process all files in a folder and upload them to memory - OPTIMIZED VERSION"""
    import time
    import os
    import glob
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from pathlib import Path
    
    start_time = time.time()
    
    try:
        folder_path = request.folder_path
        
        # Validate folder path
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail=f"Folder path does not exist: {folder_path}")
        
        if not os.path.isdir(folder_path):
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {folder_path}")
        
        # OPTIMIZATION 1: Use pathlib for faster file discovery
        folder_path_obj = Path(folder_path)
        
        if request.recursive:
            # Use pathlib for recursive search - much faster than glob
            all_files = [str(f) for f in folder_path_obj.rglob("*") if f.is_file()]
        else:
            all_files = [str(f) for f in folder_path_obj.iterdir() if f.is_file()]
        
        # OPTIMIZATION 2: Filter by extensions early to reduce processing
        if request.file_extensions:
            ext_set = {ext.lower() for ext in request.file_extensions}
            files = [f for f in all_files if Path(f).suffix.lower() in ext_set]
        else:
            files = all_files
        
        if not files:
            return FolderUploadResponse(
                success=True,
                total_files_found=0,
                successful_uploads=0,
                failed_uploads=0,
                processing_time=time.time() - start_time,
                results=[],
                message="No files found in the specified folder"
            )
        
        # OPTIMIZATION 3: Read files in parallel using ThreadPoolExecutor
        def read_file(file_path):
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                    return {
                        "filename": os.path.basename(file_path),
                        "content": content,
                        "size": len(content)
                    }
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
                return None
        
        # Use ThreadPoolExecutor for I/O bound file reading
        with ThreadPoolExecutor(max_workers=min(10, len(files))) as executor:
            file_data_futures = [executor.submit(read_file, file_path) for file_path in files]
            file_data = [future.result() for future in file_data_futures if future.result() is not None]
        
        if not file_data:
            raise HTTPException(status_code=500, detail="Failed to read any files from the folder")
        
        # OPTIMIZATION 4: Skip property extraction for faster processing if not needed
        # OPTIMIZATION 5: Use direct document memory storage instead of full workflow for simple cases
        if not request.extract_property_data and len(file_data) > 5:
            # For bulk uploads without property extraction, use direct storage
            result = await _process_files_directly(file_data)
        else:
            # Use parallel processing workflow for complex cases
            result = await parallel_processing_workflow.process_files(
                files=file_data,
                extract_property_data=request.extract_property_data
            )
        
        # Invalidate AI agent cache since new documents were added
        try:
            from app.api.v1.ai_agent import invalidate_document_cache
            invalidate_document_cache()
        except ImportError:
            pass  # AI agent module not available
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Count successful vs failed files
        successful_uploads = result.get("successful_uploads", 0)
        failed_uploads = result.get("failed_uploads", 0)
        
        return FolderUploadResponse(
            success=result.get("success", False),
            total_files_found=len(files),
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads,
            processing_time=processing_time,
            results=result.get("results", []),
            message=f"Processed {len(files)} files: {successful_uploads} successful, {failed_uploads} failed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process folder: {str(e)}")

async def _process_files_directly(file_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    OPTIMIZATION: Direct file processing without full workflow overhead
    For bulk uploads where property extraction is not needed
    """
    import asyncio
    from app.services.file_router import FileRouter
    from app.core.langchain.memory.document_memory import DocumentMemory, DocumentType
    
    file_router = FileRouter()
    document_memory = DocumentMemory()
    
    successful_uploads = 0
    failed_uploads = 0
    results = []
    
    # Process files in parallel batches
    async def process_single_file(file_info):
        try:
            filename = file_info["filename"]
            content = file_info["content"]
            
            # Quick file type detection
            file_type = file_router.get_file_type(filename)
            
            # Parse file content
            parsed_content = await file_router.parse_file_from_bytes(content, filename)
            
            # Extract text
            extracted_text = _extract_text_from_parsed_content(parsed_content)
            
            if not extracted_text:
                return {
                    "success": False,
                    "filename": filename,
                    "error": "No text content extracted"
                }
            
            # Convert file type to DocumentType
            file_type_mapping = {
                "pdf": DocumentType.PDF,
                "docx": DocumentType.DOCX,
                "doc": DocumentType.DOCX,
                "pptx": DocumentType.PPTX,
                "ppt": DocumentType.PPTX,
                "xlsx": DocumentType.XLSX,
                "xls": DocumentType.XLSX,
                "csv": DocumentType.CSV,
                "txt": DocumentType.TXT,
                "rtf": DocumentType.RTF,
                "odt": DocumentType.ODT
            }
            
            document_type = file_type_mapping.get(file_type, DocumentType.TXT)
            
            # Store in memory directly
            document_id = await document_memory.store_document(
                content=extracted_text,
                filename=filename,
                document_type=document_type,
                file_size=len(content),
                source="folder_upload"
            )
            
            return {
                "success": True,
                "filename": filename,
                "document_id": document_id,
                "file_type": file_type,
                "content_length": len(extracted_text)
            }
                        
        except Exception as e:
            return {
                "success": False,
                "filename": file_info["filename"],
                "error": str(e)
            }
    
    # Process files in parallel with limited concurrency
    semaphore = asyncio.Semaphore(5)  # Limit concurrent processing
    
    async def process_with_semaphore(file_info):
        async with semaphore:
            return await process_single_file(file_info)
    
    # Execute all file processing tasks
    tasks = [process_with_semaphore(file_info) for file_info in file_data]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Count results
    for result in results:
        if isinstance(result, Exception):
            failed_uploads += 1
        elif result.get("success"):
            successful_uploads += 1
        else:
            failed_uploads += 1
    
    return {
        "success": successful_uploads > 0,
        "successful_uploads": successful_uploads,
        "failed_uploads": failed_uploads,
        "results": results
    }

def _extract_text_from_parsed_content(parsed_content: Dict[str, Any]) -> str:
    """Extract text content from parsed file content"""
    if not parsed_content:
        return ""
    
    # Try different content fields
    if "extracted_text" in parsed_content:
        return parsed_content["extracted_text"]
    elif "text" in parsed_content:
        return parsed_content["text"]
    elif "content" in parsed_content:
        return parsed_content["content"]
    elif "worksheets" in parsed_content:
        # Handle Excel/CSV worksheets
        text_parts = []
        for worksheet in parsed_content["worksheets"]:
            if "text_content" in worksheet:
                text_parts.append(worksheet["text_content"])
        return "\n\n".join(text_parts)
    elif "sheets" in parsed_content:
        # Legacy support for sheets
        text_parts = []
        for sheet in parsed_content["sheets"]:
            if "text_content" in sheet:
                text_parts.append(sheet["text_content"])
        return "\n\n".join(text_parts)
    
    return ""

@router.get("/memory/stats")
async def get_memory_stats():
    """Get memory system statistics"""
    try:
        stats = await document_memory.get_document_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get memory stats: {str(e)}")