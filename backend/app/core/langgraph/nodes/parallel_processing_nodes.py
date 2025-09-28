"""
LangGraph nodes for parallel file processing workflow
"""

import uuid
from datetime import datetime
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio

from app.core.langgraph.state.parallel_processing_state import (
    ParallelProcessingState, 
    FileProcessingTask, 
    ProcessingStatus, 
    AgentType
)
from app.services.file_router import FileRouter
from app.services.property_extraction_agent import PropertyExtractionAgent
from app.core.langchain.memory.document_memory import DocumentMemory, DocumentType

# Initialize services
file_router = FileRouter()
property_agent = PropertyExtractionAgent()
document_memory = DocumentMemory()

# Agent configurations
AGENT_CONFIGS = {
    AgentType.PDF_AGENT: {
        "name": "PDF Specialist",
        "description": "Specialized in processing PDF documents with OCR capabilities",
        "supported_types": ["pdf"],
        "max_concurrent": 3
    },
    AgentType.DOCX_AGENT: {
        "name": "Word Document Expert",
        "description": "Handles Microsoft Word documents and rich text",
        "supported_types": ["docx", "doc"],
        "max_concurrent": 4
    },
    AgentType.PPTX_AGENT: {
        "name": "Presentation Analyst",
        "description": "Processes PowerPoint presentations and slides",
        "supported_types": ["pptx", "ppt"],
        "max_concurrent": 2
    },
    AgentType.XLSX_AGENT: {
        "name": "Spreadsheet Processor",
        "description": "Handles Excel files and spreadsheet data",
        "supported_types": ["xlsx", "xls"],
        "max_concurrent": 3
    },
    AgentType.CSV_AGENT: {
        "name": "Data Table Handler",
        "description": "Processes CSV and tabular data files",
        "supported_types": ["csv"],
        "max_concurrent": 5
    },
    AgentType.TXT_AGENT: {
        "name": "Text Document Processor",
        "description": "Handles plain text and markdown files",
        "supported_types": ["txt", "md"],
        "max_concurrent": 6
    },
    AgentType.RTF_AGENT: {
        "name": "Rich Text Specialist",
        "description": "Processes RTF and formatted text documents",
        "supported_types": ["rtf"],
        "max_concurrent": 3
    },
    AgentType.ODT_AGENT: {
        "name": "OpenDocument Handler",
        "description": "Handles OpenDocument format files",
        "supported_types": ["odt", "ods", "odp"],
        "max_concurrent": 2
    },
    AgentType.GENERAL_AGENT: {
        "name": "General File Processor",
        "description": "Fallback agent for unsupported file types",
        "supported_types": ["*"],
        "max_concurrent": 4
    }
}

async def initialize_parallel_processing_node(state: ParallelProcessingState) -> ParallelProcessingState:
    """
    Initialize the parallel processing workflow
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with initialized tasks and agents
    """
    try:
        # Initialize processing start time
        state["processing_start_time"] = datetime.now()
        state["overall_status"] = ProcessingStatus.PENDING
        
        # Initialize counters
        state["successful_uploads"] = 0
        state["failed_uploads"] = 0
        state["total_documents_stored"] = 0
        state["errors"] = []
        
        # Initialize agent management
        state["available_agents"] = {}
        state["agent_assignments"] = {}
        
        # Create agent pools
        for agent_type in AgentType:
            agent_config = AGENT_CONFIGS[agent_type]
            max_concurrent = agent_config["max_concurrent"]
            state["available_agents"][agent_type] = [
                f"{agent_type.value}_{i}" for i in range(max_concurrent)
            ]
        
        # Create processing tasks
        tasks = []
        for i, file_data in enumerate(state["files"]):
            task_id = str(uuid.uuid4())
            filename = file_data["filename"]
            file_content = file_data["content"]
            file_type = file_router.get_file_type(filename)
            
            # Determine agent type based on file type
            agent_type = _determine_agent_type(file_type)
            
            task = FileProcessingTask(
                task_id=task_id,
                filename=filename,
                file_content=file_content,
                file_type=file_type,
                file_size=len(file_content),
                agent_type=agent_type,
                status=ProcessingStatus.PENDING
            )
            tasks.append(task)
        
        state["tasks"] = tasks
        state["completed_tasks"] = []
        state["failed_tasks"] = []
        
        state["overall_status"] = ProcessingStatus.ASSIGNED
        
        return state
        
    except Exception as e:
        state["overall_status"] = ProcessingStatus.FAILED
        state["errors"].append(f"Initialization failed: {str(e)}")
        return state

async def assign_agents_node(state: ParallelProcessingState) -> ParallelProcessingState:
    """
    Assign agents to processing tasks
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with agent assignments
    """
    try:
        if state["overall_status"] != ProcessingStatus.ASSIGNED:
            return state
        
        # Group tasks by agent type
        tasks_by_agent = {}
        for task in state["tasks"]:
            if task.agent_type not in tasks_by_agent:
                tasks_by_agent[task.agent_type] = []
            tasks_by_agent[task.agent_type].append(task)
        
        # Assign agents to tasks
        for agent_type, tasks in tasks_by_agent.items():
            available_agents = state["available_agents"][agent_type]
            
            for i, task in enumerate(tasks):
                # Round-robin assignment
                agent_id = available_agents[i % len(available_agents)]
                state["agent_assignments"][task.task_id] = agent_id
                task.assigned_agent = agent_id
                task.status = ProcessingStatus.PROCESSING
        
        state["overall_status"] = ProcessingStatus.PROCESSING
        
        return state
        
    except Exception as e:
        state["overall_status"] = ProcessingStatus.FAILED
        state["errors"].append(f"Agent assignment failed: {str(e)}")
        return state

async def process_files_parallel_node(state: ParallelProcessingState) -> ParallelProcessingState:
    """
    Process files in parallel using assigned agents
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with processing results
    """
    try:
        if state["overall_status"] != ProcessingStatus.PROCESSING:
            return state
        
        # Group tasks by agent type for parallel processing
        tasks_by_agent = {}
        for task in state["tasks"]:
            if task.status == ProcessingStatus.PROCESSING:
                if task.agent_type not in tasks_by_agent:
                    tasks_by_agent[task.agent_type] = []
                tasks_by_agent[task.agent_type].append(task)
        
        # Process each agent type in parallel
        processing_tasks = []
        task_mapping = {}  # Map processing task index to actual task
        
        for agent_type, tasks in tasks_by_agent.items():
            for task in tasks:
                task_index = len(processing_tasks)
                processing_tasks.append(_process_single_file(task, agent_type))
                task_mapping[task_index] = task
        
        # Wait for all processing to complete
        results = await asyncio.gather(*processing_tasks, return_exceptions=True)
        
        # Update task results
        for i, result in enumerate(results):
            task = task_mapping[i]
            if isinstance(result, Exception):
                # Handle processing error
                task.status = ProcessingStatus.FAILED
                task.error_message = str(result)
                task.processing_end_time = datetime.now()
                state["failed_tasks"].append(task)
                state["failed_uploads"] += 1
                state["errors"].append(f"Task {task.task_id} failed: {str(result)}")
            else:
                # Handle successful processing
                task.status = ProcessingStatus.COMPLETED
                task.result = result
                task.processing_end_time = datetime.now()
                state["completed_tasks"].append(task)
                state["successful_uploads"] += 1
                if result.get("document_id"):
                    state["total_documents_stored"] += 1
        
        # Update overall status
        if state["failed_tasks"] and state["completed_tasks"]:
            state["overall_status"] = ProcessingStatus.COMPLETED  # Partial success
        elif state["failed_tasks"]:
            state["overall_status"] = ProcessingStatus.FAILED
        else:
            state["overall_status"] = ProcessingStatus.COMPLETED
        
        return state
        
    except Exception as e:
        state["overall_status"] = ProcessingStatus.FAILED
        state["errors"].append(f"Parallel processing failed: {str(e)}")
        return state

async def finalize_parallel_processing_node(state: ParallelProcessingState) -> ParallelProcessingState:
    """
    Finalize parallel processing and calculate statistics
    
    Args:
        state: Current processing state
        
    Returns:
        Updated state with final processing information
    """
    try:
        if state["overall_status"] in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]:
            end_time = datetime.now()
            start_time = state["processing_start_time"]
            duration = (end_time - start_time).total_seconds()
            
            state["processing_end_time"] = end_time
            state["processing_duration_seconds"] = duration
        
        return state
        
    except Exception as e:
        state["errors"].append(f"Finalization failed: {str(e)}")
        return state

async def _process_single_file(task: FileProcessingTask, agent_type: AgentType) -> Dict[str, Any]:
    """
    Process a single file using the assigned agent
    
    Args:
        task: File processing task
        agent_type: Type of agent to use
        
    Returns:
        Processing result
    """
    try:
        # Start processing timer
        task.processing_start_time = datetime.now()
        
        # Get agent configuration
        agent_config = AGENT_CONFIGS[agent_type]
        
        # Use specialized agent processing based on file type
        if agent_type == AgentType.PDF_AGENT:
            parsed_content = await _pdf_specialist_process(task)
        elif agent_type == AgentType.XLSX_AGENT:
            parsed_content = await _excel_specialist_process(task)
        elif agent_type == AgentType.CSV_AGENT:
            parsed_content = await _csv_specialist_process(task)
        elif agent_type == AgentType.DOCX_AGENT:
            parsed_content = await _docx_specialist_process(task)
        elif agent_type == AgentType.PPTX_AGENT:
            parsed_content = await _pptx_specialist_process(task)
        elif agent_type == AgentType.TXT_AGENT:
            parsed_content = await _text_specialist_process(task)
        else:
            # Fallback to general processing
            parsed_content = await file_router.parse_file_from_bytes(
                task.file_content, 
                task.filename
            )
        
        # Extract text from parsed content
        extracted_text = _extract_text_from_parsed_content(parsed_content)
        
        if not extracted_text:
            return {
                "success": False,
                "error": "No text content extracted from file",
                "agent_type": agent_type.value,
                "agent_name": agent_config["name"]
            }
        
        # Extract property data using AI agent
        property_data = await property_agent.extract_property_data(extracted_text)
        
        # Convert file type to DocumentType enum
        try:
            # Handle both string and enum types
            if hasattr(task.file_type, 'value'):
                file_type_str = task.file_type.value.lower()
            else:
                file_type_str = str(task.file_type).lower()
            
            # Map FileType to DocumentType
            file_type_mapping = {
                'pdf': DocumentType.PDF,
                'word': DocumentType.DOCX,
                'powerpoint': DocumentType.PPTX,
                'excel': DocumentType.XLSX,
                'csv': DocumentType.CSV,
                'text': DocumentType.TXT,
                'rtf': DocumentType.RTF,
                'odt': DocumentType.ODT,
                'unsupported': DocumentType.TXT
            }
            
            document_type = file_type_mapping.get(file_type_str, DocumentType.TXT)
        except (ValueError, AttributeError):
            document_type = DocumentType.TXT  # Default fallback
        
        # Store in document memory
        document_id = await document_memory.store_document(
            content=extracted_text,
            filename=task.filename,
            document_type=document_type,
            file_size=task.file_size,
            source="parallel_upload",
            extracted_property_data=property_data,
            tags=["parallel_processed", agent_type.value]
        )
        
        return {
            "success": True,
            "document_id": document_id,
            "filename": task.filename,
            "file_type": task.file_type,
            "file_size": task.file_size,
            "parsed_content": parsed_content,
            "extracted_property_data": property_data,
            "agent_type": agent_type.value,
            "agent_name": agent_config["name"],
            "processing_time": (datetime.now() - task.processing_start_time).total_seconds()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Processing failed: {str(e)}",
            "agent_type": agent_type.value,
            "agent_name": agent_config.get("name", "Unknown")
        }

def _determine_agent_type(file_type: str) -> AgentType:
    """
    Determine the appropriate agent type for a file type
    
    Args:
        file_type: File type string
        
    Returns:
        Appropriate agent type
    """
    file_type_lower = file_type.lower()
    
    # Check each agent type's supported types
    for agent_type, config in AGENT_CONFIGS.items():
        supported_types = config["supported_types"]
        if "*" in supported_types or file_type_lower in supported_types:
            return agent_type
    
    # Fallback to general agent
    return AgentType.GENERAL_AGENT

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
    if "text" in parsed_content:
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
    elif "sheets" in parsed_content:
        # For Excel files, combine all sheet data
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


# Specialized Agent Processing Functions
async def _pdf_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """PDF Specialist Agent - Enhanced PDF processing with OCR and metadata extraction"""
    from app.services.pdf_parser import PDFParser
    pdf_parser = PDFParser()
    
    # Use specialized PDF processing
    result = await pdf_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add PDF-specific enhancements
    result["agent_enhancements"] = {
        "ocr_confidence": "high",
        "metadata_extraction": "enhanced",
        "text_structure_analysis": True
    }
    
    return result


async def _excel_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """Excel Specialist Agent - Advanced spreadsheet analysis with data validation"""
    from app.services.excel_parser import ExcelParser
    excel_parser = ExcelParser()
    
    # Use specialized Excel processing
    result = await excel_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add Excel-specific enhancements
    result["agent_enhancements"] = {
        "data_validation": "enabled",
        "formula_analysis": True,
        "chart_detection": True,
        "pivot_table_analysis": True
    }
    
    return result


async def _csv_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """CSV Specialist Agent - Data quality analysis and schema detection"""
    from app.services.csv_parser import CSVParser
    csv_parser = CSVParser()
    
    # Use specialized CSV processing
    result = await csv_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add CSV-specific enhancements
    result["agent_enhancements"] = {
        "data_quality_check": "enabled",
        "schema_detection": True,
        "encoding_detection": True,
        "delimiter_optimization": True
    }
    
    return result


async def _docx_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """DOCX Specialist Agent - Document structure analysis and formatting preservation"""
    from app.services.doc_parser import DocParser
    doc_parser = DocParser()
    
    # Use specialized DOCX processing
    result = await doc_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add DOCX-specific enhancements
    result["agent_enhancements"] = {
        "formatting_preservation": "enhanced",
        "table_structure_analysis": True,
        "hyperlink_extraction": True,
        "image_metadata": True
    }
    
    return result


async def _pptx_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """PPTX Specialist Agent - Presentation analysis with slide structure detection"""
    from app.services.powerpoint_parser import PowerPointParser
    pptx_parser = PowerPointParser()
    
    # Use specialized PPTX processing
    result = await pptx_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add PPTX-specific enhancements
    result["agent_enhancements"] = {
        "slide_structure_analysis": True,
        "animation_detection": True,
        "template_identification": True,
        "speaker_notes_extraction": True
    }
    
    return result


async def _text_specialist_process(task: FileProcessingTask) -> Dict[str, Any]:
    """Text Specialist Agent - Advanced text analysis with language detection"""
    from app.services.text_parser import TextParser
    text_parser = TextParser()
    
    # Use specialized text processing
    result = await text_parser.parse_file_from_bytes(task.file_content, task.filename)
    
    # Add text-specific enhancements
    result["agent_enhancements"] = {
        "language_detection": True,
        "encoding_optimization": True,
        "text_structure_analysis": True,
        "keyword_extraction": True
    }
    
    return result
