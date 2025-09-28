"""
CSV Parser Service
Extracts data from CSV files
"""

import os
import csv
from typing import Dict, Any, List
import pandas as pd

class CSVParser:
    """Parser for CSV files"""
    
    def __init__(self):
        """Initialize the CSV parser"""
        pass
    
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
            
            # Create text representation
            text_lines = []
            
            # Add headers
            if result["headers"]:
                text_lines.append(" | ".join(result["headers"]))
                text_lines.append("-" * len(" | ".join(result["headers"])))
            
            # Add data rows
            for row in data_list:
                if any(cell.strip() for cell in row):  # Skip empty rows
                    text_lines.append(" | ".join(cell.strip() for cell in row))
            
            result["extracted_text"] = "\n".join(text_lines)
            
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

