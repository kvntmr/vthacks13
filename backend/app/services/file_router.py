"""
File Router Service
Routes different file types to their corresponding parsers
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional, Union
from enum import Enum
import asyncio

from app.services.powerpoint_parser import PowerPointParser
from app.services.pdf_parser import PDFParser
from app.services.text_parser import TextParser
from app.services.doc_parser import DocParser
from app.services.excel_parser import ExcelParser
from app.services.csv_parser import CSVParser
from app.services.rtf_parser import RTFParser
from app.services.odt_parser import ODTParser

class FileType(str, Enum):
    POWERPOINT = "powerpoint"
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    TEXT = "text"
    CSV = "csv"
    RTF = "rtf"
    ODT = "odt"
    UNSUPPORTED = "unsupported"

class FileRouter:
    """Routes files to appropriate parsers based on file type"""
    
    def __init__(self):
        self.supported_extensions = {
            # Presentation files
            '.pptx': FileType.POWERPOINT,
            '.ppt': FileType.POWERPOINT,
            
            # Document files
            '.pdf': FileType.PDF,
            '.docx': FileType.WORD,
            '.doc': FileType.WORD,
            '.rtf': FileType.RTF,
            '.odt': FileType.ODT,
            
            # Spreadsheet files
            '.xlsx': FileType.EXCEL,
            '.xls': FileType.EXCEL,
            '.csv': FileType.CSV,
            '.tsv': FileType.CSV,
            
            # Text files
            '.txt': FileType.TEXT,
            '.text': FileType.TEXT,
            '.log': FileType.TEXT,
            '.md': FileType.TEXT,
            '.markdown': FileType.TEXT
        }
        
        # Initialize parsers
        self.parsers = {
            FileType.POWERPOINT: PowerPointParser(""),
            FileType.PDF: PDFParser(),
            FileType.WORD: DocParser(),
            FileType.EXCEL: ExcelParser(),
            FileType.CSV: CSVParser(),
            FileType.TEXT: TextParser(),
            FileType.RTF: RTFParser(),
            FileType.ODT: ODTParser()
        }
    
    def get_file_type(self, filename: str) -> FileType:
        """
        Determine file type based on extension
        
        Args:
            filename: Name of the file
            
        Returns:
            FileType enum value
        """
        extension = Path(filename).suffix.lower()
        return self.supported_extensions.get(extension, FileType.UNSUPPORTED)
    
    def is_supported(self, filename: str) -> bool:
        """
        Check if file type is supported
        
        Args:
            filename: Name of the file
            
        Returns:
            True if supported, False otherwise
        """
        return self.get_file_type(filename) != FileType.UNSUPPORTED
    
    async def parse_file(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Parse a file using the appropriate parser
        
        Args:
            file_path: Path to the file
            filename: Name of the file
            
        Returns:
            Dictionary containing parsed content and metadata
        """
        file_type = self.get_file_type(filename)
        
        if file_type == FileType.UNSUPPORTED:
            raise ValueError(f"Unsupported file type: {filename}")
        
        if file_type not in self.parsers:
            raise NotImplementedError(f"Parser for {file_type} not yet implemented")
        
        # Route to appropriate parser
        parser = self.parsers[file_type]
        
        if file_type == FileType.POWERPOINT:
            return await parser.parse_powerpoint(file_path)
        elif file_type == FileType.PDF:
            return await parser.parse_file(file_path)
        elif file_type == FileType.WORD:
            return await parser.parse_file(file_path)
        elif file_type == FileType.EXCEL:
            return await parser.parse_file(file_path)
        elif file_type == FileType.CSV:
            return await parser.parse_file(file_path)
        elif file_type == FileType.TEXT:
            return await parser.parse_file(file_path)
        elif file_type == FileType.RTF:
            return await parser.parse_file(file_path)
        elif file_type == FileType.ODT:
            return await parser.parse_file(file_path)
        
        raise NotImplementedError(f"Parser for {file_type} not yet implemented")
    
    async def parse_file_from_bytes(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Parse a file from bytes using the appropriate parser
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            
        Returns:
            Dictionary containing parsed content and metadata
        """
        file_type = self.get_file_type(filename)
        
        if file_type == FileType.UNSUPPORTED:
            raise ValueError(f"Unsupported file type: {filename}")
        
        if file_type not in self.parsers:
            raise NotImplementedError(f"Parser for {file_type} not yet implemented")
        
        # Route to appropriate parser
        parser = self.parsers[file_type]
        
        if file_type == FileType.POWERPOINT:
            return await parser.parse_powerpoint_from_bytes(file_content, filename)
        elif file_type == FileType.PDF:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.WORD:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.EXCEL:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.CSV:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.TEXT:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.RTF:
            return await parser.parse_file_from_bytes(file_content, filename)
        elif file_type == FileType.ODT:
            return await parser.parse_file_from_bytes(file_content, filename)
        
        raise NotImplementedError(f"Parser for {file_type} not yet implemented")
    
    def get_supported_formats(self) -> Dict[str, list]:
        """
        Get list of supported file formats
        
        Returns:
            Dictionary mapping file types to supported extensions
        """
        formats = {}
        for ext, file_type in self.supported_extensions.items():
            if file_type not in formats:
                formats[file_type] = []
            formats[file_type].append(ext)
        
        return formats
    
    def get_parser_status(self) -> Dict[str, bool]:
        """
        Get status of available parsers
        
        Returns:
            Dictionary mapping file types to implementation status
        """
        status = {}
        for file_type in FileType:
            if file_type == FileType.UNSUPPORTED:
                continue
            status[file_type] = file_type in self.parsers
        
        return status
