"""
Excel Parser Service
Extracts data from Excel files (.xlsx, .xls)
"""

import os
from typing import Dict, Any, List
import pandas as pd
from openpyxl import load_workbook
from openpyxl.workbook import Workbook

class ExcelParser:
    """Parser for Excel files"""
    
    def __init__(self):
        """Initialize the Excel parser"""
        pass
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse an Excel file and extract data
        
        Args:
            file_path: Path to the Excel file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Excel file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "excel",
                "worksheets": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_worksheets": 0,
                    "total_cells_with_data": 0,
                    "total_text_length": 0
                }
            }
            
            # Load workbook for metadata
            workbook = load_workbook(file_path, data_only=True)
            
            # Extract metadata
            result["metadata"] = {
                "creator": workbook.properties.creator or "",
                "title": workbook.properties.title or "",
                "subject": workbook.properties.subject or "",
                "description": workbook.properties.description or "",
                "keywords": workbook.properties.keywords or "",
                "last_modified_by": workbook.properties.lastModifiedBy or "",
                "created": str(workbook.properties.created) if workbook.properties.created else "",
                "modified": str(workbook.properties.modified) if workbook.properties.modified else "",
                "version": workbook.properties.version or ""
            }
            
            # Extract data from each worksheet
            all_text = []
            total_cells = 0
            
            for sheet_name in workbook.sheetnames:
                worksheet_data = {
                    "sheet_name": sheet_name,
                    "data": [],
                    "text_content": "",
                    "dimensions": {
                        "max_row": 0,
                        "max_column": 0
                    }
                }
                
                # Read worksheet with pandas for easier data handling
                try:
                    df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
                    
                    # Get dimensions
                    worksheet_data["dimensions"] = {
                        "max_row": len(df),
                        "max_column": len(df.columns)
                    }
                    
                    # Convert to list of lists for consistency
                    data_list = df.fillna("").astype(str).values.tolist()
                    worksheet_data["data"] = data_list
                    
                    # Create text representation
                    text_lines = []
                    for row in data_list:
                        # Filter out empty rows
                        if any(cell.strip() for cell in row):
                            text_lines.append(" | ".join(cell.strip() for cell in row if cell.strip()))
                    
                    worksheet_data["text_content"] = "\n".join(text_lines)
                    all_text.append(f"[WORKSHEET: {sheet_name}]\n{worksheet_data['text_content']}")
                    
                    # Count non-empty cells
                    non_empty_cells = sum(1 for row in data_list for cell in row if cell.strip())
                    total_cells += non_empty_cells
                    
                except Exception as e:
                    worksheet_data["error"] = f"Failed to read worksheet {sheet_name}: {str(e)}"
                
                result["worksheets"].append(worksheet_data)
            
            # Combine all text
            result["extracted_text"] = "\n\n".join(all_text)
            result["processing_summary"] = {
                "total_worksheets": len(workbook.sheetnames),
                "total_cells_with_data": total_cells,
                "total_text_length": len(result["extracted_text"])
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "excel",
                "error": f"Failed to parse Excel file: {str(e)}",
                "extracted_text": "",
                "worksheets": [],
                "metadata": {},
                "processing_summary": {
                    "total_worksheets": 0,
                    "total_cells_with_data": 0,
                    "total_text_length": 0
                }
            }
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".xlsx", ".xls"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        file_ext = os.path.splitext(file_path.lower())[1]
        return file_ext in self.get_supported_formats()

