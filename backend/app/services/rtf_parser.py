"""
RTF Parser Service
Extracts text content from RTF (Rich Text Format) files
"""

import os
from typing import Dict, Any, List
from striprtf.striprtf import rtf_to_text

class RTFParser:
    """Parser for RTF files"""
    
    def __init__(self):
        """Initialize the RTF parser"""
        pass
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse an RTF file and extract text content
        
        Args:
            file_path: Path to the RTF file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"RTF file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "rtf",
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "file_size_bytes": 0,
                    "total_lines": 0,
                    "total_text_length": 0
                }
            }
            
            # Get file size
            file_size = os.path.getsize(file_path)
            result["metadata"] = {
                "file_size_bytes": file_size
            }
            
            # Read and parse RTF file
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                rtf_content = f.read()
            
            # Convert RTF to plain text
            try:
                text_content = rtf_to_text(rtf_content)
            except Exception as e:
                # Fallback: try to extract text manually by removing RTF codes
                text_content = self._simple_rtf_extract(rtf_content)
            
            result["extracted_text"] = text_content.strip()
            result["processing_summary"] = {
                "file_size_bytes": file_size,
                "total_lines": len(text_content.splitlines()),
                "total_text_length": len(text_content)
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "rtf",
                "error": f"Failed to parse RTF file: {str(e)}",
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "file_size_bytes": 0,
                    "total_lines": 0,
                    "total_text_length": 0
                }
            }
    
    def _simple_rtf_extract(self, rtf_content: str) -> str:
        """
        Simple RTF text extraction as fallback
        Removes basic RTF formatting codes
        """
        import re
        
        # Remove RTF header
        text = re.sub(r'\\[a-z]+\d*\s?', '', rtf_content)
        
        # Remove braces
        text = text.replace('{', '').replace('}', '')
        
        # Remove control characters
        text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        return text.strip()
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".rtf"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        return file_path.lower().endswith('.rtf')

