"""
ODT Parser Service
Extracts text content from OpenDocument Text files
"""

import os
from typing import Dict, Any, List
from odf.opendocument import load
from odf.text import P, H
from odf.table import Table, TableRow, TableCell

class ODTParser:
    """Parser for ODT files"""
    
    def __init__(self):
        """Initialize the ODT parser"""
        pass
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse an ODT file and extract text content
        
        Args:
            file_path: Path to the ODT file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"ODT file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "odt",
                "paragraphs": [],
                "tables": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_paragraphs": 0,
                    "total_tables": 0,
                    "total_text_length": 0
                }
            }
            
            # Load the ODT document
            doc = load(file_path)
            
            # Extract metadata
            meta = doc.meta
            result["metadata"] = {
                "title": meta.getAttribute("title") or "",
                "subject": meta.getAttribute("subject") or "",
                "keywords": meta.getAttribute("keywords") or "",
                "description": meta.getAttribute("description") or "",
                "creator": meta.getAttribute("creator") or "",
                "date": meta.getAttribute("date") or "",
                "language": meta.getAttribute("language") or ""
            }
            
            # Extract paragraphs and text
            all_text = []
            paragraph_count = 0
            table_count = 0
            
            # Get all text elements
            text_elements = doc.getElementsByType(P)
            heading_elements = doc.getElementsByType(H)
            table_elements = doc.getElementsByType(Table)
            
            # Process paragraphs
            for element in text_elements:
                text_content = self._extract_text_from_element(element)
                if text_content.strip():
                    paragraph_data = {
                        "paragraph_number": paragraph_count + 1,
                        "text": text_content.strip(),
                        "type": "paragraph",
                        "text_length": len(text_content.strip())
                    }
                    result["paragraphs"].append(paragraph_data)
                    all_text.append(text_content.strip())
                    paragraph_count += 1
            
            # Process headings
            for element in heading_elements:
                text_content = self._extract_text_from_element(element)
                if text_content.strip():
                    paragraph_data = {
                        "paragraph_number": paragraph_count + 1,
                        "text": text_content.strip(),
                        "type": "heading",
                        "text_length": len(text_content.strip())
                    }
                    result["paragraphs"].append(paragraph_data)
                    all_text.append(f"# {text_content.strip()}")
                    paragraph_count += 1
            
            # Process tables
            for table in table_elements:
                table_data = {
                    "table_number": table_count + 1,
                    "data": [],
                    "text_content": ""
                }
                
                rows = table.getElementsByType(TableRow)
                table_text_lines = []
                
                for row in rows:
                    cells = row.getElementsByType(TableCell)
                    row_data = []
                    cell_texts = []
                    
                    for cell in cells:
                        cell_text = self._extract_text_from_element(cell)
                        row_data.append(cell_text.strip())
                        cell_texts.append(cell_text.strip())
                    
                    table_data["data"].append(row_data)
                    if any(cell.strip() for cell in cell_texts):
                        table_text_lines.append(" | ".join(cell_texts))
                
                table_data["text_content"] = "\n".join(table_text_lines)
                result["tables"].append(table_data)
                
                if table_data["text_content"]:
                    all_text.append(f"\n[TABLE {table_count + 1}]\n{table_data['text_content']}\n")
                
                table_count += 1
            
            # Combine all text
            result["extracted_text"] = "\n\n".join(all_text)
            result["processing_summary"] = {
                "total_paragraphs": paragraph_count,
                "total_tables": table_count,
                "total_text_length": len(result["extracted_text"])
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "odt",
                "error": f"Failed to parse ODT file: {str(e)}",
                "extracted_text": "",
                "paragraphs": [],
                "tables": [],
                "metadata": {},
                "processing_summary": {
                    "total_paragraphs": 0,
                    "total_tables": 0,
                    "total_text_length": 0
                }
            }
    
    def _extract_text_from_element(self, element) -> str:
        """Extract text from an ODF element recursively"""
        text_parts = []
        
        for child in element.childNodes:
            if hasattr(child, 'data'):
                # Text node
                text_parts.append(child.data)
            elif hasattr(child, 'childNodes'):
                # Element with children
                text_parts.append(self._extract_text_from_element(child))
        
        return "".join(text_parts)
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".odt"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        return file_path.lower().endswith('.odt')

