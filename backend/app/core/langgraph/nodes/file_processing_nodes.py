"""
LangGraph nodes for file processing workflow
"""

import os
from datetime import datetime
from typing import Dict, Any
from pathlib import Path

from app.core.langgraph.state.file_processing_state import FileProcessingState, ProcessingStatus
from app.services.file_router import FileRouter
from app.services.property_extraction_agent import PropertyExtractionAgent
from app.core.langchain.memory.document_memory import DocumentMemory, DocumentType

# Initialize services
file_router = FileRouter()
property_agent = PropertyExtractionAgent()
from app.core.langchain.memory.shared_memory import get_document_memory
document_memory = get_document_memory()

async def validate_file_node(state: FileProcessingState) -> FileProcessingState:
    """
    Validate file and check if it's supported
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with validation results
    """
    try:
        filename = state["filename"]
        
        # Check if file type is supported
        is_supported = file_router.is_supported(filename)
        file_type = file_router.get_file_type(filename)
        
        state["supported"] = is_supported
        state["file_type"] = file_type
        state["file_size"] = len(state["file_content"])
        state["status"] = ProcessingStatus.PARSING if is_supported else ProcessingStatus.FAILED
        
        if not is_supported:
            state["error_message"] = f"Unsupported file type: {filename}. Supported formats: {file_router.get_supported_formats()}"
        
        return state
        
    except Exception as e:
        state["status"] = ProcessingStatus.FAILED
        state["error_message"] = f"File validation failed: {str(e)}"
        return state

async def parse_file_node(state: FileProcessingState) -> FileProcessingState:
    """
    Parse file content using the file router
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with parsed content
    """
    try:
        if state["status"] != ProcessingStatus.PARSING:
            return state
        
        filename = state["filename"]
        file_content = state["file_content"]
        
        # Parse the file content
        parsed_content = await file_router.parse_file_from_bytes(file_content, filename)
        state["parsed_content"] = parsed_content
        
        # Extract text from parsed content
        extracted_text = _extract_text_from_parsed_content(parsed_content)
        state["extracted_text"] = extracted_text
        
        if extracted_text:
            state["status"] = ProcessingStatus.EXTRACTING
        else:
            state["status"] = ProcessingStatus.STORING  # Skip extraction if no text
        
        return state
        
    except Exception as e:
        state["status"] = ProcessingStatus.FAILED
        state["error_message"] = f"File parsing failed: {str(e)}"
        return state

async def extract_property_data_node(state: FileProcessingState) -> FileProcessingState:
    """
    Extract property data using AI agent
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with extracted property data
    """
    try:
        if state["status"] != ProcessingStatus.EXTRACTING:
            return state
        
        extracted_text = state["extracted_text"]
        
        if not extracted_text:
            state["status"] = ProcessingStatus.STORING
            return state
        
        # Use AI agent to extract property data
        property_data = await property_agent.extract_property_data(extracted_text)
        state["extracted_property_data"] = property_data
        
        state["status"] = ProcessingStatus.STORING
        return state
        
    except Exception as e:
        # Don't fail the entire process if property extraction fails
        state["extracted_property_data"] = {"error": f"Failed to extract property data: {str(e)}"}
        state["status"] = ProcessingStatus.STORING
        return state

async def store_in_memory_node(state: FileProcessingState) -> FileProcessingState:
    """
    Store parsed content in document memory
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with storage results
    """
    try:
        if state["status"] != ProcessingStatus.STORING:
            return state
        
        extracted_text = state["extracted_text"]
        filename = state["filename"]
        file_type_str = state["file_type"]
        file_size = state["file_size"]
        extracted_property_data = state["extracted_property_data"]
        
        if not extracted_text:
            state["status"] = ProcessingStatus.COMPLETED
            state["stored_successfully"] = False
            return state
        
        # Convert file type string to enum
        try:
            document_type = DocumentType(file_type_str.lower())
        except ValueError:
            document_type = DocumentType.TXT  # Default fallback
        
        # Store in document memory
        document_id = await document_memory.store_document(
            content=extracted_text,
            filename=filename,
            document_type=document_type,
            file_size=file_size,
            source="file_upload",
            extracted_property_data=extracted_property_data,
            tags=["uploaded", "processed"]
        )
        
        state["document_id"] = document_id
        state["stored_successfully"] = True
        state["status"] = ProcessingStatus.COMPLETED
        
        return state
        
    except Exception as e:
        state["status"] = ProcessingStatus.FAILED
        state["error_message"] = f"Memory storage failed: {str(e)}"
        state["stored_successfully"] = False
        return state

async def finalize_processing_node(state: FileProcessingState) -> FileProcessingState:
    """
    Finalize processing and calculate duration
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with final processing information
    """
    try:
        if state["status"] == ProcessingStatus.COMPLETED:
            end_time = datetime.now()
            start_time = state["processing_start_time"]
            duration = (end_time - start_time).total_seconds()
            
            state["processing_end_time"] = end_time
            state["processing_duration_seconds"] = duration
        
        return state
        
    except Exception as e:
        state["error_message"] = f"Finalization failed: {str(e)}"
        return state

def _extract_text_from_parsed_content(parsed_content: Dict[str, Any]) -> str:
    """
    Extract text content from parsed file content
    
    Args:
        parsed_content: Parsed content from file router
        
    Returns:
        Extracted text string
    """
    if not parsed_content:
        return ""
    
    # Handle different file types
    if "extracted_text" in parsed_content:
        # Use the structured extracted text from parsers
        return parsed_content["extracted_text"]
    elif "text" in parsed_content:
        return parsed_content["text"]
    elif "content" in parsed_content:
        return parsed_content["content"]
    elif "slides" in parsed_content:
        # For PowerPoint files, combine all slide text
        slides = parsed_content.get("slides", [])
        text_parts = []
        for slide in slides:
            if isinstance(slide, dict) and "text" in slide:
                text_parts.append(slide["text"])
            elif isinstance(slide, str):
                text_parts.append(slide)
        return "\n".join(text_parts)
    elif "worksheets" in parsed_content:
        # For Excel files, combine all worksheet data
        worksheets = parsed_content.get("worksheets", [])
        text_parts = []
        for worksheet in worksheets:
            if isinstance(worksheet, dict) and "text_content" in worksheet:
                text_parts.append(worksheet["text_content"])
            elif isinstance(worksheet, dict) and "data" in worksheet:
                # Convert worksheet data to text
                data = worksheet["data"]
                if isinstance(data, list):
                    for row in data:
                        if isinstance(row, list):
                            text_parts.append("\t".join(str(cell) for cell in row))
                        else:
                            text_parts.append(str(row))
        return "\n".join(text_parts)
    elif "sheets" in parsed_content:
        # Legacy support for "sheets" key
        sheets = parsed_content.get("sheets", [])
        text_parts = []
        for sheet in sheets:
            if isinstance(sheet, dict) and "data" in sheet:
                # Convert sheet data to text
                data = sheet["data"]
                if isinstance(data, list):
                    for row in data:
                        if isinstance(row, list):
                            text_parts.append("\t".join(str(cell) for cell in row))
                        else:
                            text_parts.append(str(row))
        return "\n".join(text_parts)
    else:
        # Fallback: try to extract any string values
        text_parts = []
        for key, value in parsed_content.items():
            if isinstance(value, str):
                text_parts.append(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, dict):
                        for sub_key, sub_value in item.items():
                            if isinstance(sub_value, str):
                                text_parts.append(sub_value)
        
        return "\n".join(text_parts)

