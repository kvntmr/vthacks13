"""
PDF Parser Service
Extracts text and metadata from PDF files using pdfplumber
"""

import pdfplumber
from typing import Dict, Any, List
import os
from pathlib import Path
import io

class PDFParser:
    """Parser for PDF files"""
    
    def __init__(self):
        """Initialize the PDF parser"""
        pass
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a PDF file and extract text content
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PDF file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "pdf",
                "pages": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_pages": 0,
                    "pages_with_text": 0,
                    "total_text_length": 0
                }
            }
            
            with pdfplumber.open(file_path) as pdf:
                # Extract metadata
                result["metadata"] = {
                    "title": pdf.metadata.get("Title", ""),
                    "author": pdf.metadata.get("Author", ""),
                    "subject": pdf.metadata.get("Subject", ""),
                    "creator": pdf.metadata.get("Creator", ""),
                    "producer": pdf.metadata.get("Producer", ""),
                    "creation_date": str(pdf.metadata.get("CreationDate", "")),
                    "modification_date": str(pdf.metadata.get("ModDate", ""))
                }
                
                # Extract text from each page
                all_text = []
                pages_with_text = 0
                
                for page_num, page in enumerate(pdf.pages, 1):
                    page_data = {
                        "page_number": page_num,
                        "text": "",
                        "text_length": 0,
                        "tables": [],
                        "images": []
                    }
                    
                    # Extract text
                    page_text = page.extract_text()
                    if page_text:
                        page_data["text"] = page_text.strip()
                        page_data["text_length"] = len(page_text)
                        all_text.append(page_text)
                        pages_with_text += 1
                    
                    # Extract tables
                    tables = page.extract_tables()
                    if tables:
                        for table_num, table in enumerate(tables):
                            table_data = {
                                "table_number": table_num + 1,
                                "rows": len(table),
                                "columns": len(table[0]) if table else 0,
                                "data": table
                            }
                            page_data["tables"].append(table_data)
                    
                    # Note: pdfplumber doesn't extract images directly
                    # Images would need additional processing with other libraries
                    
                    result["pages"].append(page_data)
                
                # Combine all text
                result["extracted_text"] = "\n\n".join(all_text)
                result["processing_summary"] = {
                    "total_pages": len(pdf.pages),
                    "pages_with_text": pages_with_text,
                    "total_text_length": len(result["extracted_text"])
                }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "pdf",
                "error": f"Failed to parse PDF: {str(e)}",
                "extracted_text": "",
                "pages": [],
                "metadata": {},
                "processing_summary": {
                    "total_pages": 0,
                    "pages_with_text": 0,
                    "total_text_length": 0
                }
            }
    
    async def parse_file_from_bytes(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Parse PDF content from bytes
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            result = {
                "file_path": filename,
                "file_name": filename,
                "file_type": "pdf",
                "pages": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_pages": 0,
                    "pages_with_text": 0,
                    "total_text_length": 0
                }
            }
            
            # Create a BytesIO object from the file content
            pdf_bytes = io.BytesIO(file_content)
            
            with pdfplumber.open(pdf_bytes) as pdf:
                # Extract metadata
                result["metadata"] = {
                    "title": pdf.metadata.get("Title", ""),
                    "author": pdf.metadata.get("Author", ""),
                    "subject": pdf.metadata.get("Subject", ""),
                    "creator": pdf.metadata.get("Creator", ""),
                    "producer": pdf.metadata.get("Producer", ""),
                    "creation_date": str(pdf.metadata.get("CreationDate", "")),
                    "modification_date": str(pdf.metadata.get("ModDate", "")),
                    "file_size_bytes": len(file_content)
                }
                
                # Extract text from each page
                pages_with_text = 0
                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text() or ""
                    
                    page_data = {
                        "page_number": page_num,
                        "text": page_text,
                        "text_length": len(page_text),
                        "has_text": len(page_text.strip()) > 0
                    }
                    
                    result["pages"].append(page_data)
                    result["extracted_text"] += page_text + "\n"
                    
                    if page_data["has_text"]:
                        pages_with_text += 1
                
                # Update processing summary
                result["processing_summary"] = {
                    "total_pages": len(pdf.pages),
                    "pages_with_text": pages_with_text,
                    "total_text_length": len(result["extracted_text"])
                }
            
            return result
            
        except Exception as e:
            return {
                "file_path": filename,
                "file_name": filename,
                "file_type": "pdf",
                "error": f"Failed to parse PDF: {str(e)}",
                "extracted_text": "",
                "pages": [],
                "metadata": {},
                "processing_summary": {
                    "total_pages": 0,
                    "pages_with_text": 0,
                    "total_text_length": 0
                }
            }
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".pdf"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        return file_path.lower().endswith('.pdf')

