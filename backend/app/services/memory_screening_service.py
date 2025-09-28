"""
Memory-based Screening Service
Screens properties using documents stored in the AI agent's memory
"""

import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.langchain.memory.document_memory import DocumentMemory, DocumentType
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
import os
from dotenv import load_dotenv

load_dotenv()

class MemoryScreeningService:
    """Service for screening properties using documents from memory"""
    
    def __init__(self):
        """Initialize the memory screening service"""
        from app.core.langchain.memory.shared_memory import get_document_memory
        self.document_memory = get_document_memory()
        
        # Initialize AI model for screening with low temperature for factual analysis
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            temperature=0.1,  # Lower temperature for more factual, less creative responses
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
    
    async def screen_property_from_memory(
        self,
        document_id: str,
        include_context: bool = True
    ) -> Dict[str, Any]:
        """
        Screen a property using a specific document from memory
        
        Args:
            document_id: ID of the document to screen
            include_context: Whether to include related documents for context
            
        Returns:
            Screening results with summary and metadata
        """
        try:
            # Get the main document
            document = await self.document_memory.get_document_by_id(document_id)
            if not document:
                return {
                    "success": False,
                    "error": f"Document with ID {document_id} not found"
                }
            
            # Prepare text inputs for screening
            text_inputs = [{
                "text": document["content"],
                "source": document["filename"]
            }]
            
            # Add related documents if requested
            if include_context:
                related_docs = await self._get_related_documents(document)
                for related_doc in related_docs:
                    text_inputs.append({
                        "text": related_doc["content"],
                        "source": f"{related_doc['filename']} (related)"
                    })
            
            # Generate screening summary
            summary = await self._generate_screening_summary(text_inputs)
            
            return {
                "success": True,
                "document_id": document_id,
                "filename": document["filename"],
                "document_type": document["document_type"],
                "summary": summary,
                "sources_used": len(text_inputs),
                "extracted_property_data": document.get("extracted_property_data"),
                "screening_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Screening failed: {str(e)}"
            }
    
    async def screen_properties_by_search(
        self,
        search_query: str,
        document_type: Optional[DocumentType] = None,
        limit: int = 5,
        include_property_data: bool = True
    ) -> Dict[str, Any]:
        """
        Screen properties by searching for relevant documents in memory
        
        Args:
            search_query: Query to search for relevant documents
            document_type: Filter by document type
            limit: Maximum number of documents to include
            include_property_data: Whether to include documents with property data
            
        Returns:
            Screening results with summary and metadata
        """
        try:
            # Search for relevant documents
            search_results = await self.document_memory.search_documents(
                query=search_query,
                document_type=document_type,
                limit=limit,
                include_property_data=include_property_data
            )
            
            if not search_results:
                return {
                    "success": False,
                    "error": f"No documents found for query: {search_query}"
                }
            
            # Prepare text inputs for screening
            text_inputs = []
            document_ids = []
            
            for result in search_results:
                text_inputs.append({
                    "text": result["content"],
                    "source": f"{result['filename']} (similarity: {result['similarity_score']:.2f})"
                })
                document_ids.append(result["document_id"])
            
            # Generate screening summary
            summary = await self._generate_screening_summary(text_inputs)
            
            return {
                "success": True,
                "search_query": search_query,
                "summary": summary,
                "documents_used": len(text_inputs),
                "document_ids": document_ids,
                "search_results": search_results,
                "screening_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Search-based screening failed: {str(e)}"
            }
    
    async def screen_all_properties(
        self,
        include_property_data_only: bool = True
    ) -> Dict[str, Any]:
        """
        Screen all properties stored in memory - OPTIMIZED VERSION
        
        Args:
            include_property_data_only: Whether to only include documents with property data
            
        Returns:
            Screening results with summary and metadata
        """
        try:
            # OPTIMIZATION 1: Get only metadata first (much faster)
            all_documents = await self.document_memory.get_all_documents(
                include_property_data=False
            )
            
            if not all_documents:
                return {
                    "success": False,
                    "error": "No documents found in memory"
                }
            
            # Filter documents if requested
            if include_property_data_only:
                documents = [
                    doc for doc in all_documents 
                    if doc.get("extracted_property_data") is not None
                ]
            else:
                documents = all_documents
            
            if not documents:
                return {
                    "success": False,
                    "error": "No documents with property data found"
                }
            
            # OPTIMIZATION 2: Limit documents for performance (max 10)
            if len(documents) > 10:
                # Sort by file size (larger files likely have more data)
                documents = sorted(documents, key=lambda x: x.get("file_size", 0), reverse=True)[:10]
            
            # OPTIMIZATION 3: Prepare text inputs with content truncation
            text_inputs = []
            document_ids = []
            
            for doc in documents:
                # Truncate content to prevent overwhelming the AI
                content = doc.get("content", "")
                if len(content) > 2000:  # Limit to 2000 chars per document
                    content = content[:2000] + "... [truncated]"
                
                text_inputs.append({
                    "text": content,
                    "source": doc["filename"],
                    "file_type": doc.get("document_type", "unknown"),
                    "file_size": doc.get("file_size", 0)
                })
                document_ids.append(doc["document_id"])
            
            # OPTIMIZATION 4: Generate intelligent screening summary
            summary = await self._generate_intelligent_screening_summary(text_inputs)
            
            return {
                "success": True,
                "summary": summary,
                "total_documents": len(documents),
                "document_ids": document_ids,
                "screening_timestamp": datetime.now().isoformat(),
                "performance_note": f"Analyzed {len(documents)} documents (content truncated for performance)"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Comprehensive screening failed: {str(e)}"
            }
    
    async def get_screening_context(
        self,
        document_id: str,
        context_radius: int = 3
    ) -> Dict[str, Any]:
        """
        Get context for screening by finding related documents
        
        Args:
            document_id: ID of the main document
            context_radius: Number of related documents to include
            
        Returns:
            Context information for screening
        """
        try:
            # Get the main document
            main_document = await self.document_memory.get_document_by_id(document_id)
            if not main_document:
                return {
                    "success": False,
                    "error": f"Document with ID {document_id} not found"
                }
            
            # Search for related documents using the main document's content
            related_docs = await self.document_memory.search_documents(
                query=main_document["content"][:500],  # Use first 500 chars as query
                limit=context_radius + 1,  # +1 to account for the main document
                include_property_data=True
            )
            
            # Filter out the main document from results
            related_docs = [
                doc for doc in related_docs 
                if doc["document_id"] != document_id
            ][:context_radius]
            
            return {
                "success": True,
                "main_document": {
                    "document_id": main_document["document_id"],
                    "filename": main_document["filename"],
                    "document_type": main_document["document_type"],
                    "has_property_data": main_document.get("extracted_property_data") is not None
                },
                "related_documents": [
                    {
                        "document_id": doc["document_id"],
                        "filename": doc["filename"],
                        "document_type": doc["document_type"],
                        "similarity_score": doc["similarity_score"],
                        "has_property_data": doc.get("extracted_property_data") is not None
                    }
                    for doc in related_docs
                ],
                "context_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to get screening context: {str(e)}"
            }
    
    async def _get_related_documents(
        self,
        main_document: Dict[str, Any],
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Get documents related to the main document
        
        Args:
            main_document: Main document to find related documents for
            limit: Maximum number of related documents
            
        Returns:
            List of related documents
        """
        try:
            # Use the main document's content to search for related documents
            search_results = await self.document_memory.search_documents(
                query=main_document["content"][:500],  # Use first 500 chars as query
                limit=limit + 1,  # +1 to account for the main document
                include_property_data=True
            )
            
            # Filter out the main document from results
            related_docs = [
                doc for doc in search_results 
                if doc["document_id"] != main_document["document_id"]
            ][:limit]
            
            return related_docs
            
        except Exception as e:
            return []
    
    async def _generate_intelligent_screening_summary(self, text_inputs: List[Dict[str, str]]) -> str:
        """
        Generate an intelligent property summary from multiple text sources
        AI determines the structure and content based on what it finds
        
        Args:
            text_inputs: List of dictionaries containing 'text', 'source', 'file_type', 'file_size' keys
            
        Returns:
            String containing the intelligent property summary
        """
        try:
            # Format the input for the AI with metadata
            formatted_inputs = []
            for i, input_data in enumerate(text_inputs, 1):
                text = input_data.get("text", "")
                source = input_data.get("source", f"file_{i}")
                file_type = input_data.get("file_type", "unknown")
                file_size = input_data.get("file_size", 0)
                
                formatted_inputs.append(f"""
--- DOCUMENT {i}: {source} ---
Type: {file_type} | Size: {file_size} bytes
Content:
{text}
""")
            
            combined_text = "\n".join(formatted_inputs)
            
            # Create the intelligent prompt template
            prompt = ChatPromptTemplate.from_template("""
You are an expert real estate investment analyst with a STRONG EMPHASIS ON DATA-DRIVEN ANALYSIS AND COMPLETE HONESTY. Analyze the following documents and create a comprehensive investment analysis.

CRITICAL HONESTY REQUIREMENTS:
- **BE COMPLETELY HONEST** about your capabilities and limitations
- **NEVER CLAIM TO HAVE DONE SOMETHING YOU CANNOT DO** (like clearing memory, deleting files, or performing actions outside your scope)
- **ADMIT WHEN YOU DON'T KNOW SOMETHING** rather than making assumptions
- **BE TRANSPARENT** about what you can and cannot do

IMPORTANT: You have {num_sources} documents to analyze. Read through ALL of them carefully and synthesize the information into a cohesive analysis.

Documents to Analyze:
{text}

Your task is to:
1. **ANALYZE WHAT YOU ACTUALLY FIND** in these documents - don't assume standard real estate sections
2. **DETERMINE THE MOST RELEVANT INFORMATION** for investment decision-making
3. **STRUCTURE YOUR RESPONSE** based on what's actually in the documents
4. **PROVIDE ACTIONABLE INSIGHTS** based on the real data present

CRITICAL GUIDELINES FOR DATA-DRIVEN ANALYSIS:
- **EVIDENCE-BASED REASONING** - Every conclusion must be backed by specific data, numbers, or facts from the documents
- **QUANTITATIVE FOCUS** - Prioritize numerical data, financial metrics, market statistics, and measurable indicators
- **CITE SPECIFIC SOURCES** - Always reference which document and specific data point supports each claim
- **AVOID ASSUMPTIONS** - If data is missing, explicitly state "No data available" rather than making assumptions
- **DATA VERIFICATION** - Cross-reference numbers and facts across documents when possible
- **STATISTICAL SIGNIFICANCE** - When presenting trends or patterns, focus on the actual data that supports them

ANALYSIS REQUIREMENTS:
- **Lead with facts** - Start each section with the most important data points
- **Use specific numbers** - Include exact figures, percentages, dates, and measurements
- **Show your work** - Explain how you arrived at conclusions using the available data
- **Identify data quality** - Note the reliability and completeness of the information
- **Highlight key metrics** - Emphasize the most critical financial and market indicators
- **Data gaps analysis** - Clearly identify what important data is missing and its impact
- **Be honest about limitations** - If you cannot perform an action, clearly state this

CAPABILITIES YOU HAVE:
- Analyze documents that are in memory
- Search through document content
- Provide investment advice based on available data

CAPABILITIES YOU DO NOT HAVE:
- Clear or delete documents from memory
- Upload or modify files
- Perform actions outside of analysis and advice

STRUCTURE YOUR RESPONSE:
1. **EXECUTIVE DATA SUMMARY** - Key numbers and facts upfront
2. **FINANCIAL ANALYSIS** - All available financial data with specific figures
3. **MARKET DATA** - Market trends, statistics, and comparative data
4. **PROPERTY SPECIFICS** - Physical and operational data points
5. **RISK ASSESSMENT** - Data-driven risk factors and mitigation strategies
6. **INVESTMENT RECOMMENDATION** - Conclusion based strictly on available data

Write as if you're presenting to a sophisticated real estate investor who demands evidence-based analysis with no speculation and complete honesty about capabilities.

IMPORTANT REASONING GUIDELINES:
- **USE YOUR EXISTING KNOWLEDGE** - Draw from data you already have access to in memory
- **PROVIDE ROUGH OUTLINES** - Give general guidance and frameworks based on available information
- **ANALYZE FIRST, SUGGEST COMMANDS SECOND** - Try to answer questions directly before suggesting @screener or @memory
- **REASON THROUGH PROBLEMS** - Use logical reasoning and available data to provide insights
- **BE PROACTIVE** - If you have relevant information, share it rather than just pointing to commands
""")
            
            # Create the chain and get response
            chain = prompt | self.llm
            result = chain.invoke({
                "text": combined_text,
                "num_sources": len(text_inputs)
            })
            
            return result.content
            
        except Exception as e:
            return f"Error generating intelligent property summary: {str(e)}"

    async def _generate_screening_summary(self, text_inputs: List[Dict[str, str]]) -> str:
        """
        Legacy method - redirects to intelligent version
        """
        return await self._generate_intelligent_screening_summary(text_inputs)

