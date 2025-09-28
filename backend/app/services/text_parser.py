"""
Text File Parser Service
Extracts text content from plain text files
"""

import os
from typing import Dict, Any, List
import chardet

class TextParser:
    """Parser for plain text files"""
    
    def __init__(self):
        """Initialize the text parser"""
        self.supported_encodings = ['utf-8', 'utf-16', 'ascii', 'latin-1', 'cp1252']
    
    async def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a text file and extract content
        
        Args:
            file_path: Path to the text file
            
        Returns:
            Dictionary containing parsed content
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Text file not found: {file_path}")
            
            result = {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "text",
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "file_size_bytes": 0,
                    "total_lines": 0,
                    "total_text_length": 0,
                    "encoding_detected": "unknown"
                }
            }
            
            # Get file size
            file_size = os.path.getsize(file_path)
            result["processing_summary"]["file_size_bytes"] = file_size
            
            # Detect encoding
            with open(file_path, 'rb') as f:
                raw_data = f.read()
                encoding_result = chardet.detect(raw_data)
                detected_encoding = encoding_result.get('encoding', 'utf-8')
                confidence = encoding_result.get('confidence', 0)
            
            result["metadata"] = {
                "detected_encoding": detected_encoding,
                "encoding_confidence": confidence,
                "file_size_bytes": file_size
            }
            
            # Try to read the file with detected encoding
            text_content = ""
            encoding_used = detected_encoding
            
            try:
                with open(file_path, 'r', encoding=detected_encoding) as f:
                    text_content = f.read()
            except (UnicodeDecodeError, UnicodeError):
                # Fallback to other encodings
                for encoding in self.supported_encodings:
                    try:
                        with open(file_path, 'r', encoding=encoding) as f:
                            text_content = f.read()
                        encoding_used = encoding
                        break
                    except (UnicodeDecodeError, UnicodeError):
                        continue
                
                if not text_content:
                    # Last resort: read as binary and decode with errors='ignore'
                    with open(file_path, 'rb') as f:
                        raw_data = f.read()
                        text_content = raw_data.decode('utf-8', errors='ignore')
                    encoding_used = 'utf-8 (with errors ignored)'
            
            result["extracted_text"] = text_content
            result["processing_summary"] = {
                "file_size_bytes": file_size,
                "total_lines": len(text_content.splitlines()),
                "total_text_length": len(text_content),
                "encoding_detected": encoding_used
            }
            
            return result
            
        except Exception as e:
            return {
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "file_type": "text",
                "error": f"Failed to parse text file: {str(e)}",
                "extracted_text": "",
                "metadata": {},
                "processing_summary": {
                    "file_size_bytes": 0,
                    "total_lines": 0,
                    "total_text_length": 0,
                    "encoding_detected": "unknown"
                }
            }
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        return [".txt", ".text", ".log", ".md", ".markdown", ".csv"]
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file format is supported"""
        file_ext = os.path.splitext(file_path.lower())[1]
        return file_ext in self.get_supported_formats()

