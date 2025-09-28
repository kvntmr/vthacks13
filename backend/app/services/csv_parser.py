"""
CSV Parser Service
Extracts data from CSV files with improved AI-readable formatting
"""

import os
import io
import csv
from typing import Dict, Any, List
import pandas as pd

class CSVParser:
    """Parser for CSV files with enhanced AI-readable formatting"""
    
    def __init__(self):
        """Initialize the CSV parser"""
        pass
    
    def _create_structured_text(self, data_list: List[List[str]], headers: List[str], filename: str) -> str:
        """
        Create table-formatted text representation of CSV data for AI recognition
        
        Args:
            data_list: List of rows with cell data
            headers: List of column headers
            filename: Name of the file
            
        Returns:
            Table-formatted text representation
        """
        text_lines = []
        
        # Add file header
        text_lines.append(f"=== CSV FILE: {filename} ===")
        text_lines.append(f"Dimensions: {len(data_list)} rows × {len(headers)} columns")
        text_lines.append("")
        
        # Create table format
        if headers:
            # Create table header
            header_line = " | ".join(headers)
            separator_line = "-" * len(header_line)
            text_lines.append(header_line)
            text_lines.append(separator_line)
            
            # Add data rows
            for i, row in enumerate(data_list):
                if any(cell.strip() for cell in row):  # Skip empty rows
                    # Align row data with headers
                    row_data = []
                    for j, cell in enumerate(row):
                        if j < len(headers):
                            row_data.append(cell.strip() if cell.strip() else "")
                        else:
                            break
                    
                    # Pad row if it's shorter than headers
                    while len(row_data) < len(headers):
                        row_data.append("")
                    
                    row_line = " | ".join(row_data)
                    text_lines.append(row_line)
        else:
            # No headers, format as simple table
            text_lines.append("DATA (No headers detected):")
            for i, row in enumerate(data_list):
                if any(cell.strip() for cell in row):
                    row_line = " | ".join(cell.strip() for cell in row if cell.strip())
                    text_lines.append(row_line)
        
        return "\n".join(text_lines)
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a CSV file and extract data
        
        Args:
            file_path: Path to the CSV file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"CSV file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "csv",
                "data": [],
                "headers": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_rows": 0,
                    "total_columns": 0,
                    "total_text_length": 0
                }
            }
            
            # Get file size
            file_size = os.path.getsize(file_path)
            result["metadata"] = {
                "file_size_bytes": file_size
            }
            
            # Read CSV with pandas for better handling
            try:
                # Try to detect delimiter automatically
                with open(file_path, 'r', encoding='utf-8') as f:
                    sample = f.read(1024)
                    sniffer = csv.Sniffer()
                    delimiter = sniffer.sniff(sample).delimiter
            except:
                delimiter = ','  # Default to comma
            
            # Read the CSV file
            df = pd.read_csv(file_path, delimiter=delimiter, encoding='utf-8')
            
            # Extract headers
            result["headers"] = df.columns.tolist()
            
            # Extract data
            data_list = df.fillna("").astype(str).values.tolist()
            result["data"] = data_list
            
            # Create structured text representation
            result["extracted_text"] = self._create_structured_text(data_list, result["headers"], result["file_name"])
            
            result["processing_summary"] = {
                "total_rows": len(data_list),
                "total_columns": len(result["headers"]),
                "total_text_length": len(result["extracted_text"])
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "csv",
                "error": f"Failed to parse CSV file: {str(e)}",
                "extracted_text": "",
                "data": [],
                "headers": [],
                "metadata": {},
                "processing_summary": {
                    "total_rows": 0,
                    "total_columns": 0,
                    "total_text_length": 0
                }
            }
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".csv", ".tsv"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        file_ext = os.path.splitext(file_path.lower())[1]
        return file_ext in self.get_supported_formats()
    
    async def parse_file_from_bytes(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Parse a CSV file from bytes and extract data
        
        Args:
            file_content: CSV file content as bytes
            filename: Name of the file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            result = {
                "file_path": filename,
                "file_name": filename,
                "file_type": "csv",
                "data": [],
                "headers": [],
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "total_rows": 0,
                    "total_columns": 0,
                    "total_text_length": 0
                }
            }
            
            # Get file size
            result["metadata"] = {
                "file_size_bytes": len(file_content)
            }
            
            # Create StringIO object for pandas
            file_buffer = io.StringIO(file_content.decode('utf-8'))
            
            # Try to detect delimiter automatically
            try:
                file_buffer.seek(0)
                sample = file_buffer.read(1024)
                file_buffer.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
            except:
                delimiter = ','  # Default to comma
            
            # Read the CSV file
            df = pd.read_csv(file_buffer, delimiter=delimiter, encoding='utf-8')
            
            # Extract headers
            result["headers"] = df.columns.tolist()
            
            # Extract data
            data_list = df.fillna("").astype(str).values.tolist()
            result["data"] = data_list
            
            # Create structured text representation
            result["extracted_text"] = self._create_structured_text(data_list, result["headers"], result["file_name"])
            
            result["processing_summary"] = {
                "total_rows": len(data_list),
                "total_columns": len(result["headers"]),
                "total_text_length": len(result["extracted_text"])
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": filename,
                "file_name": filename,
                "file_type": "csv",
                "error": f"Failed to parse CSV file: {str(e)}",
                "extracted_text": "",
                "data": [],
                "headers": [],
                "metadata": {},
                "processing_summary": {
                    "total_rows": 0,
                    "total_columns": 0,
                    "total_text_length": 0
                }
            }