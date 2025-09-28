"""
LangGraph workflow for file processing
"""

from datetime import datetime
from typing import Dict, Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.core.langgraph.state.file_processing_state import FileProcessingState, ProcessingStatus
from app.core.langgraph.nodes.file_processing_nodes import (
    validate_file_node,
    parse_file_node,
    extract_property_data_node,
    store_in_memory_node,
    finalize_processing_node
)

def create_file_processing_workflow() -> StateGraph:
    """
    Create the file processing workflow
    
    Returns:
        Compiled StateGraph for file processing
    """
    
    # Create the workflow graph
    workflow = StateGraph(FileProcessingState)
    
    # Add nodes
    workflow.add_node("validate_file", validate_file_node)
    workflow.add_node("parse_file", parse_file_node)
    workflow.add_node("extract_property_data", extract_property_data_node)
    workflow.add_node("store_in_memory", store_in_memory_node)
    workflow.add_node("finalize_processing", finalize_processing_node)
    
    # Define the workflow edges
    workflow.set_entry_point("validate_file")
    
    # Add conditional edges based on processing status
    workflow.add_conditional_edges(
        "validate_file",
        _should_continue_after_validation,
        {
            "parse": "parse_file",
            "fail": END
        }
    )
    
    workflow.add_conditional_edges(
        "parse_file",
        _should_continue_after_parsing,
        {
            "extract": "extract_property_data",
            "store": "store_in_memory",
            "fail": END
        }
    )
    
    workflow.add_conditional_edges(
        "extract_property_data",
        _should_continue_after_extraction,
        {
            "store": "store_in_memory",
            "fail": END
        }
    )
    
    workflow.add_conditional_edges(
        "store_in_memory",
        _should_continue_after_storage,
        {
            "finalize": "finalize_processing",
            "fail": END
        }
    )
    
    workflow.add_edge("finalize_processing", END)
    
    # Compile the workflow
    memory = MemorySaver()
    compiled_workflow = workflow.compile(checkpointer=memory)
    
    return compiled_workflow

def _should_continue_after_validation(state: FileProcessingState) -> str:
    """Determine next step after file validation"""
    if state["status"] == ProcessingStatus.FAILED:
        return "fail"
    elif state["supported"]:
        return "parse"
    else:
        return "fail"

def _should_continue_after_parsing(state: FileProcessingState) -> str:
    """Determine next step after file parsing"""
    if state["status"] == ProcessingStatus.FAILED:
        return "fail"
    elif state["status"] == ProcessingStatus.EXTRACTING:
        return "extract"
    elif state["status"] == ProcessingStatus.STORING:
        return "store"
    else:
        return "fail"

def _should_continue_after_extraction(state: FileProcessingState) -> str:
    """Determine next step after property data extraction"""
    if state["status"] == ProcessingStatus.FAILED:
        return "fail"
    elif state["status"] == ProcessingStatus.STORING:
        return "store"
    else:
        return "fail"

def _should_continue_after_storage(state: FileProcessingState) -> str:
    """Determine next step after memory storage"""
    if state["status"] == ProcessingStatus.FAILED:
        return "fail"
    elif state["status"] == ProcessingStatus.COMPLETED:
        return "finalize"
    else:
        return "fail"

class FileProcessingWorkflow:
    """Wrapper class for the file processing workflow"""
    
    def __init__(self):
        """Initialize the workflow"""
        self.workflow = create_file_processing_workflow()
    
    async def process_file(
        self,
        file_content: bytes,
        filename: str,
        file_path: str = None
    ) -> Dict[str, Any]:
        """
        Process a file through the complete workflow
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            file_path: Optional file path
            
        Returns:
            Processing results
        """
        # Create initial state
        initial_state: FileProcessingState = {
            "file_content": file_content,
            "filename": filename,
            "file_path": file_path,
            "status": ProcessingStatus.PENDING,
            "error_message": None,
            "file_type": "",
            "file_size": 0,
            "supported": False,
            "parsed_content": None,
            "extracted_text": None,
            "extracted_property_data": None,
            "document_id": None,
            "stored_successfully": False,
            "processing_start_time": datetime.now(),
            "processing_end_time": None,
            "processing_duration_seconds": None
        }
        
        # Run the workflow
        config = {"configurable": {"thread_id": f"file_processing_{filename}_{datetime.now().timestamp()}"}}
        final_state = await self.workflow.ainvoke(initial_state, config=config)
        
        # Format the response
        return {
            "success": final_state["status"] == ProcessingStatus.COMPLETED,
            "status": final_state["status"].value,
            "error_message": final_state["error_message"],
            "file_info": {
                "filename": final_state["filename"],
                "file_type": final_state["file_type"],
                "file_size": final_state["file_size"],
                "supported": final_state["supported"]
            },
            "parsed_content": final_state["parsed_content"],
            "extracted_property_data": final_state["extracted_property_data"],
            "memory_storage": {
                "document_id": final_state["document_id"],
                "stored_successfully": final_state["stored_successfully"]
            },
            "processing_info": {
                "start_time": final_state["processing_start_time"].isoformat(),
                "end_time": final_state["processing_end_time"].isoformat() if final_state["processing_end_time"] else None,
                "duration_seconds": final_state["processing_duration_seconds"]
            }
        }

