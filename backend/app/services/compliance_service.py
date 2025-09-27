import os
from pathlib import Path
from typing import List, Dict
from datetime import datetime
from app.core.models.schemas import StandardDocument, StandardDocumentList


class ComplianceService:
    """Service for managing compliance standards and documents"""
    
    def __init__(self):
        self.base_path = Path("data/standards")
        self.government_path = self.base_path / "government"
        self.industry_path = self.base_path / "industry"
    
    def get_standard_documents(self, standard_type: str = "government") -> StandardDocumentList:
        """
        Get list of standard documents from the specified directory
        
        Args:
            standard_type: "government" or "industry"
            
        Returns:
            StandardDocumentList with document information
        """
        if standard_type == "government":
            directory_path = self.government_path
        elif standard_type == "industry":
            directory_path = self.industry_path
        else:
            raise ValueError("standard_type must be 'government' or 'industry'")
        
        documents = []
        
        if directory_path.exists():
            for file_path in directory_path.iterdir():
                if file_path.is_file() and file_path.suffix.lower() == '.pdf':
                    # Get file stats
                    stat = file_path.stat()
                    
                    # Extract filename without extension
                    filename = file_path.stem
                    
                    # Create full name (you can customize this mapping)
                    full_name = self._get_full_standard_name(filename)
                    
                    document = StandardDocument(
                        filename=filename,
                        full_name=full_name,
                        file_path=str(file_path),
                        file_size=stat.st_size,
                        last_modified=datetime.fromtimestamp(stat.st_mtime),
                        standard_type=standard_type
                    )
                    documents.append(document)
        
        return StandardDocumentList(
            documents=documents,
            total_count=len(documents),
            standard_type=standard_type
        )
    
    def _get_full_standard_name(self, filename: str) -> str:
        """
        Convert filename to full standard name
        
        Args:
            filename: The filename without extension
            
        Returns:
            Full standard name
        """
        # Mapping of common filenames to full names
        standard_names = {
            "ISO_27001": "ISO/IEC 27001 - Information Security Management Systems",
            "NIST_CSF": "NIST Cybersecurity Framework",
            "NIST.CSWP.29": "NIST Cybersecurity Framework (CSWP.29)",
            "HIPAA": "Health Insurance Portability and Accountability Act (HIPAA)",
            "GDPR": "General Data Protection Regulation (GDPR)",
            "SOX": "Sarbanes-Oxley Act (SOX)",
            "PCI_DSS": "Payment Card Industry Data Security Standard (PCI-DSS)",
            "SOC2": "Service Organization Control 2 (SOC 2)",
            "COBIT": "Control Objectives for Information and Related Technologies (COBIT)",
            "ITIL": "Information Technology Infrastructure Library (ITIL)",
            "COSO": "Committee of Sponsoring Organizations (COSO)",
            "FFIEC": "Federal Financial Institutions Examination Council (FFIEC)"
        }
        
        # Try exact match first
        if filename in standard_names:
            return standard_names[filename]
        
        # Try partial matches
        for key, value in standard_names.items():
            if key.lower() in filename.lower() or filename.lower() in key.lower():
                return value
        
        # If no match found, return formatted filename
        return filename.replace("_", " ").replace(".", " ").title()
    
    def get_document_by_filename(self, filename: str, standard_type: str = "government") -> StandardDocument:
        """
        Get specific document information by filename
        
        Args:
            filename: The filename (with or without extension)
            standard_type: "government" or "industry"
            
        Returns:
            StandardDocument information
        """
        if standard_type == "government":
            directory_path = self.government_path
        elif standard_type == "industry":
            directory_path = self.industry_path
        else:
            raise ValueError("standard_type must be 'government' or 'industry'")
        
        # Remove extension if present
        filename = filename.replace('.pdf', '')
        file_path = directory_path / f"{filename}.pdf"
        
        if not file_path.exists():
            raise FileNotFoundError(f"Document {filename} not found in {standard_type} standards")
        
        stat = file_path.stat()
        full_name = self._get_full_standard_name(filename)
        
        return StandardDocument(
            filename=filename,
            full_name=full_name,
            file_path=str(file_path),
            file_size=stat.st_size,
            last_modified=datetime.fromtimestamp(stat.st_mtime),
            standard_type=standard_type
        )
