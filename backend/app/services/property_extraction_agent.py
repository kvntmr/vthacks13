"""
Property Data Extraction Agent using LangChain with Google Gemini
Extracts structured property data from raw text using AI
"""

import json
import re
import os
from typing import Dict, Any, Optional, List
from enum import Enum
from decimal import Decimal
from datetime import date

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# LangChain imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

# Simple property data models for extraction
class PropertyType(str, Enum):
    LOGISTICS = "logistics"
    INDUSTRIAL = "industrial"
    OFFICE = "office"
    RETAIL = "retail"
    RESIDENTIAL = "residential"
    MIXED_USE = "mixed_use"

class LeaseType(str, Enum):
    TRIPLE_NET = "triple_net"
    GROSS = "gross"
    NET = "net"
    ABSOLUTE_NET = "absolute_net"

class IndexationType(str, Enum):
    CPI = "cpi"
    FIXED = "fixed"
    MARKET = "market"
    NONE = "none"

class TenantGrade(str, Enum):
    A_PLUS = "A+"
    A = "A"
    B_PLUS = "B+"
    B = "B"
    C = "C"
    UNRATED = "unrated"

class PropertyDataParser:
    """Custom parser for property data extraction"""
    
    def parse(self, text: str) -> Dict[str, Any]:
        """Parse the LLM output into structured data"""
        try:
            # Try to extract JSON from the response
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                return json.loads(json_str)
            else:
                # Fallback: try to parse the entire text as JSON
                return json.loads(text)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, return a structured error
            return {
                "error": f"Failed to parse JSON: {str(e)}",
                "raw_output": text
            }

class PropertyExtractionAgent:
    """AI agent for extracting property data from text using LangChain with Google Gemini"""
    
    def __init__(self, gemini_api_key: Optional[str] = None):
        """
        Initialize the property extraction agent
        
        Args:
            gemini_api_key: Google Gemini API key (if not provided, will use environment variable)
        """
        # Get API key
        api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is required. Set GEMINI_API_KEY environment variable or pass it as parameter.")
        
        # Initialize LangChain with Gemini
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=api_key,
            temperature=0.1
        )
        
        # Create the extraction prompt template
        self.prompt_template = self._create_extraction_prompt()
        
        # Initialize parser
        self.parser = PropertyDataParser()
        
        # Create the chain
        self.chain = self.prompt_template | self.llm | JsonOutputParser()
    
    
    def _create_extraction_prompt(self) -> ChatPromptTemplate:
        """Create the prompt template for property data extraction"""
        
        template = """
You are a real estate data extraction expert. Extract structured property information from the following text.

Extract the following information and return it as a JSON object:

{{
    "property_name": "Name of the property",
    "property_type": "logistics|industrial|office|retail|residential|mixed_use",
    "location": "Property location/address",
    "country": "Country where property is located",
    "site_area_sqm": "Total site area in square meters (number only)",
    "gross_internal_area_sqm": "Gross internal area in square meters (number only)",
    "site_coverage_percent": "Site coverage percentage (number only, optional)",
    "purchase_price": "Purchase price in euros (number only)",
    "total_costs": "Total costs including acquisition (number only, optional)",
    "gross_rental_income": "Annual gross rental income in euros (number only)",
    "net_initial_yield": "Net initial yield percentage (number only, optional)",
    "tenant_name": "Primary tenant name",
    "tenant_grade": "A+|A|B+|B|C|unrated (optional)",
    "lease_type": "triple_net|gross|net|absolute_net",
    "lease_term_years": "Lease term in years (number only)",
    "break_clause_years": "Break clause after X years (number only, optional)",
    "break_penalty_months": "Break penalty in months (number only, optional)",
    "rent_per_sqm": "Rent per square meter (number only, optional)",
    "indexation_type": "cpi|fixed|market|none",
    "indexation_cap_percent": "Indexation cap percentage (number only, optional)",
    "indexation_carry_forward": "true|false (optional)",
    "landlord_capex": "Landlord capital expenditure in euros (number only, optional)",
    "tenant_capex": "Tenant capital expenditure in euros (number only, optional)",
    "target_ltv_percent": "Target loan-to-value percentage (number only, optional)",
    "senior_leverage_percent": "Senior leverage percentage (number only, optional)",
    "special_features": ["List of special features"],
    "access_details": "Access and transportation details",
    "operational_details": "Operational use details",
    "start_date": "Income start date (YYYY-MM-DD format, optional)"
}}

Text to analyze:
{text}

Return only the JSON object, no additional text or explanation.
"""
        
        return ChatPromptTemplate.from_template(template)
    
    async def extract_property_data(self, text: str) -> Dict[str, Any]:
        """
        Extract property data from text using LangChain with Gemini
        
        Args:
            text: Raw text to extract property data from
            
        Returns:
            Dictionary containing extracted property data
        """
        try:
            # Use the LangChain chain to extract data
            result = self.chain.invoke({"text": text})
            
            # Validate and clean the data
            cleaned_data = self._clean_extracted_data(result)
            
            return cleaned_data
            
        except Exception as e:
            return {
                "error": f"Failed to extract property data: {str(e)}",
                "raw_text": text[:500] + "..." if len(text) > 500 else text
            }
    
    def _clean_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and validate extracted data"""
        
        cleaned = {}
        
        # Clean string fields
        string_fields = [
            "property_name", "location", "country", "tenant_name", 
            "access_details", "operational_details", "start_date"
        ]
        
        for field in string_fields:
            if field in data and data[field]:
                cleaned[field] = str(data[field]).strip()
        
        # Clean numeric fields
        numeric_fields = [
            "site_area_sqm", "gross_internal_area_sqm", "site_coverage_percent",
            "purchase_price", "total_costs", "gross_rental_income", "net_initial_yield",
            "lease_term_years", "break_clause_years", "break_penalty_months",
            "rent_per_sqm", "indexation_cap_percent", "landlord_capex", "tenant_capex",
            "target_ltv_percent", "senior_leverage_percent"
        ]
        
        for field in numeric_fields:
            if field in data and data[field] is not None:
                try:
                    # Remove commas and convert to number
                    value = str(data[field]).replace(',', '').replace('€', '').replace('m', '')
                    cleaned[field] = float(value)
                except (ValueError, TypeError):
                    pass  # Skip invalid numeric values
        
        # Clean enum fields
        enum_mappings = {
            "property_type": PropertyType,
            "lease_type": LeaseType,
            "indexation_type": IndexationType,
            "tenant_grade": TenantGrade
        }
        
        for field, enum_class in enum_mappings.items():
            if field in data and data[field]:
                value = str(data[field]).lower().replace(' ', '_')
                try:
                    cleaned[field] = enum_class(value).value
                except ValueError:
                    # Use default value if invalid
                    if field == "property_type":
                        cleaned[field] = PropertyType.LOGISTICS.value
                    elif field == "lease_type":
                        cleaned[field] = LeaseType.TRIPLE_NET.value
                    elif field == "indexation_type":
                        cleaned[field] = IndexationType.CPI.value
        
        # Clean boolean fields
        if "indexation_carry_forward" in data:
            value = str(data["indexation_carry_forward"]).lower()
            cleaned["indexation_carry_forward"] = value in ["true", "1", "yes", "on"]
        
        # Clean list fields
        if "special_features" in data and isinstance(data["special_features"], list):
            cleaned["special_features"] = [str(item).strip() for item in data["special_features"] if item]
        
        return cleaned
    
