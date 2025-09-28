"""
AI Agent API endpoints for frontend integration
Handles user queries and triggers appropriate functions based on keywords
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import asyncio
import json
from datetime import datetime, timedelta

from app.core.langchain.memory.shared_memory import get_document_memory
from app.services.memory_screening_service import MemoryScreeningService
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain.memory import ConversationBufferWindowMemory

router = APIRouter(prefix="/ai-agent", tags=["AI Agent"])

# Initialize services with shared instance
document_memory = get_document_memory()
screening_service = MemoryScreeningService()
screening_service.document_memory = document_memory

# Initialize LLM with optimized settings for faster responses
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    temperature=0.3,  # Lower temperature for faster, more focused responses
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Fast LLM for simple queries
fast_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",  # Faster model for simple queries
    temperature=0.1,
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Performance optimization: Cache for document metadata
_document_cache = {
    "metadata": None,
    "last_updated": None,
    "cache_duration": 300  # 5 minutes
}

# Conversation context management
class ConversationContext:
    """Manages conversation history and context for AI agent"""
    
    def __init__(self):
        # In-memory storage for conversation histories
        # In production, this should be stored in a database
        self.conversations: Dict[str, ConversationBufferWindowMemory] = {}
        self.conversation_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Configuration
        self.max_messages = 12  # Keep last 12 message pairs (24 total messages)
        self.max_age_hours = 2  # Keep conversations for 2 hours
        self.max_tokens = 5000  # Approximate token limit
    
    def get_or_create_memory(self, conversation_id: str) -> ConversationBufferWindowMemory:
        """Get or create conversation memory for a conversation ID"""
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = ConversationBufferWindowMemory(
                k=self.max_messages,  # Keep last k message pairs
                return_messages=True,
                memory_key="chat_history"
            )
            self.conversation_metadata[conversation_id] = {
                "created_at": datetime.now(),
                "last_activity": datetime.now(),
                "message_count": 0
            }
        
        # Update last activity
        self.conversation_metadata[conversation_id]["last_activity"] = datetime.now()
        return self.conversations[conversation_id]
    
    def add_message_pair(self, conversation_id: str, user_message: str, ai_response: str):
        """Add a user message and AI response to conversation history"""
        memory = self.get_or_create_memory(conversation_id)
        
        # Add messages to memory
        memory.chat_memory.add_user_message(user_message)
        memory.chat_memory.add_ai_message(ai_response)
        
        # Update metadata
        self.conversation_metadata[conversation_id]["message_count"] += 1
    
    def get_conversation_context(self, conversation_id: str) -> str:
        """Get formatted conversation context for prompts"""
        if conversation_id not in self.conversations:
            return ""
        
        memory = self.conversations[conversation_id]
        messages = memory.chat_memory.messages
        
        if not messages:
            return ""
        
        # Format conversation history
        context_parts = []
        for i in range(0, len(messages), 2):
            if i + 1 < len(messages):
                user_msg = messages[i].content if hasattr(messages[i], 'content') else str(messages[i])
                ai_msg = messages[i + 1].content if hasattr(messages[i + 1], 'content') else str(messages[i + 1])
                
                context_parts.append(f"**Previous Exchange:**")
                context_parts.append(f"User: {user_msg}")
                context_parts.append(f"AI: {ai_msg}")
                context_parts.append("")
        
        return "\n".join(context_parts)
    
    def cleanup_old_conversations(self):
        """Remove old conversations to prevent memory leaks"""
        cutoff_time = datetime.now() - timedelta(hours=self.max_age_hours)
        
        conversations_to_remove = []
        for conv_id, metadata in self.conversation_metadata.items():
            if metadata["last_activity"] < cutoff_time:
                conversations_to_remove.append(conv_id)
        
        for conv_id in conversations_to_remove:
            del self.conversations[conv_id]
            del self.conversation_metadata[conv_id]
    
    def get_conversation_stats(self) -> Dict[str, Any]:
        """Get statistics about active conversations"""
        self.cleanup_old_conversations()
        
        return {
            "active_conversations": len(self.conversations),
            "total_messages": sum(meta["message_count"] for meta in self.conversation_metadata.values()),
            "oldest_conversation": min(meta["created_at"] for meta in self.conversation_metadata.values()) if self.conversation_metadata else None
        }

# Initialize conversation context manager
conversation_context = ConversationContext()

async def get_cached_document_metadata():
    """Get document metadata with caching to avoid repeated expensive operations"""
    import time
    
    current_time = time.time()
    
    # Check if cache is valid
    if (_document_cache["metadata"] is not None and 
        _document_cache["last_updated"] is not None and
        current_time - _document_cache["last_updated"] < _document_cache["cache_duration"]):
        return _document_cache["metadata"]
    
    # Cache is invalid or empty, fetch fresh data
    try:
        # Get only metadata, not full content
        all_docs = await document_memory.get_all_documents()
        
        # Extract only metadata for caching
        metadata = []
        for doc in all_docs:
            metadata.append({
                "document_id": doc.get("document_id"),
                "filename": doc.get("filename"),
                "document_type": doc.get("document_type"),
                "file_size": doc.get("file_size"),
                "upload_timestamp": doc.get("upload_timestamp"),
                "has_property_data": doc.get("extracted_property_data") is not None
            })
        
        # Update cache
        _document_cache["metadata"] = metadata
        _document_cache["last_updated"] = current_time
        
        return metadata
        
    except Exception as e:
        print(f"Error fetching document metadata: {e}")
        return _document_cache["metadata"] or []

def invalidate_document_cache():
    """Invalidate the document cache when documents are added/removed"""
    _document_cache["metadata"] = None
    _document_cache["last_updated"] = None

def is_simple_query(message: str) -> bool:
    """Detect if a query is simple and can use the faster model"""
    message_lower = message.lower().strip()
    
    # Simple greetings and basic questions
    simple_patterns = [
        'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
        'how are you', 'how are you doing', 'what can you do', 'help',
        'thanks', 'thank you', 'bye', 'goodbye'
    ]
    
    # Check if message matches simple patterns
    for pattern in simple_patterns:
        if pattern in message_lower:
            return True
    
    # Check if message is very short (likely simple)
    if len(message.strip()) < 20:
        return True
    
    return False

async def ai_analyze_document_relevance(user_query: str, doc_metadata: list) -> list:
    """
    Use AI to analyze document metadata and determine which documents are relevant to the user's query
    """
    try:
        # Prepare document information for AI analysis
        doc_info = []
        for doc in doc_metadata:
            doc_info.append({
                "filename": doc.get("filename", "Unknown"),
                "document_type": doc.get("document_type", "Unknown"),
                "file_size": doc.get("file_size", 0),
                "has_property_data": doc.get("has_property_data", False),
                "upload_timestamp": doc.get("upload_timestamp", "Unknown")
            })
        
        # Create prompt for AI to analyze document relevance
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an AI assistant that analyzes document metadata to determine relevance to user queries.

Given a user's query and a list of document metadata, identify which documents are most relevant.

Consider:
1. Filename patterns and keywords
2. Document type (CSV, Excel, PDF, etc.)
3. File size (larger files might contain more data)
4. Whether the document has extracted property data
5. Upload timestamp (newer might be more relevant)

Return ONLY a JSON list of filenames that are relevant to the query. Be selective - only include documents that are clearly relevant.

Example response: ["document1.csv", "property_analysis.xlsx"]"""),
            ("human", """User Query: {user_query}

Available Documents:
{doc_info}

Which documents are relevant to this query? Return only the filenames as a JSON list.""")
        ])
        
        # Use fast model for this analysis
        chain = prompt | fast_llm | StrOutputParser()
        
        # Format document info for the prompt
        doc_info_text = "\n".join([
            f"- {doc['filename']} ({doc['document_type']}, {doc['file_size']} bytes, property_data: {doc['has_property_data']})"
            for doc in doc_info
        ])
        
        response = await chain.ainvoke({
            "user_query": user_query,
            "doc_info": doc_info_text
        })
        
        # Parse the AI response to get relevant filenames
        import json
        try:
            relevant_filenames = json.loads(response)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract filenames from the response
            relevant_filenames = []
            for doc in doc_info:
                if doc['filename'].lower() in response.lower():
                    relevant_filenames.append(doc['filename'])
        
        # Get full document data for relevant files
        relevant_docs = []
        for doc in doc_metadata:
            if doc.get('filename') in relevant_filenames:
                # Get full document content for relevant files
                try:
                    full_doc = await document_memory.get_document_by_id(doc['document_id'])
                    if full_doc:
                        relevant_docs.append(full_doc)
                except Exception as e:
                    print(f"Error getting document {doc['filename']}: {e}")
                    # Fallback to metadata if full document retrieval fails
                    relevant_docs.append(doc)
        
        return relevant_docs
        
    except Exception as e:
        print(f"Error in AI document analysis: {e}")
        # Fallback to simple keyword matching
        return await fallback_document_search(user_query, doc_metadata)

async def fallback_document_search(user_query: str, doc_metadata: list) -> list:
    """Fallback method for finding relevant documents using simple keyword matching"""
    query_lower = user_query.lower()
    relevant_docs = []
    
    for doc in doc_metadata:
        filename = doc.get('filename', '').lower()
        doc_type = doc.get('document_type', '').lower()
        
        # Simple keyword matching
        if any(keyword in filename for keyword in ['csv', 'excel', 'table', 'data']) and any(keyword in query_lower for keyword in ['csv', 'excel', 'table', 'data']):
            try:
                full_doc = await document_memory.get_document_by_id(doc['document_id'])
                if full_doc:
                    relevant_docs.append(full_doc)
            except:
                relevant_docs.append(doc)
        elif any(keyword in filename for keyword in ['portfolio', 'property', 'investment']) and any(keyword in query_lower for keyword in ['portfolio', 'property', 'investment']):
            try:
                full_doc = await document_memory.get_document_by_id(doc['document_id'])
                if full_doc:
                    relevant_docs.append(full_doc)
            except:
                relevant_docs.append(doc)
    
    return relevant_docs

class ChatRequest(BaseModel):
    message: str = Field(..., description="User's message/query")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context")
    include_memory: bool = Field(True, description="Whether to include memory context in responses")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI agent's response")
    function_used: Optional[str] = Field(None, description="Function that was triggered")
    conversation_id: str = Field(..., description="Conversation ID")
    timestamp: datetime = Field(..., description="Response timestamp")
    memory_context: Optional[Dict[str, Any]] = Field(None, description="Memory context used")

class MemorySearchRequest(BaseModel):
    query: str = Field(..., description="Search query for memory")
    limit: int = Field(5, description="Maximum number of results to return")

class MemorySearchResponse(BaseModel):
    results: List[Dict[str, Any]] = Field(..., description="Search results from memory")
    total_found: int = Field(..., description="Total number of results found")
    query: str = Field(..., description="Original search query")

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Main chat endpoint for AI agent with conversation context
    Detects special commands and triggers appropriate functions
    """
    try:
        conversation_id = request.conversation_id or f"conv_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Check for special commands
        message_lower = request.message.lower().strip()
        
        # Handle @screener command
        if "@screener" in message_lower:
            response = await handle_screener_command(request, conversation_id)
        # Handle @memory command
        elif "@memory" in message_lower:
            response = await handle_memory_command(request, conversation_id)
        # Handle @help command
        elif "@help" in message_lower:
            response = await handle_help_command(request, conversation_id)
        # Handle @stats command
        elif "@stats" in message_lower:
            response = await handle_stats_command(request, conversation_id)
        # Handle regular chat
        else:
            response = await handle_regular_chat(request, conversation_id)
        
        # Add conversation context (except for help commands)
        if "@help" not in message_lower:
            conversation_context.add_message_pair(
                conversation_id, 
                request.message, 
                response.response
            )
        
        return response
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI agent error: {str(e)}")

async def handle_screener_command(request: ChatRequest, conversation_id: str) -> ChatResponse:
    """Handle @screener command - run memory screening"""
    try:
        # Get cached document metadata first (faster check)
        doc_metadata = await get_cached_document_metadata()
        
        if not doc_metadata:
            # Use LLM to generate a natural response for no documents
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful real estate investment AI assistant. The user tried to run a screening analysis but has no documents in memory yet. Provide a helpful, encouraging response that explains what they need to do next."),
                ("human", "The user ran @screener but has no documents in memory.")
            ])
            
            chain = prompt | fast_llm | StrOutputParser()
            response = await chain.ainvoke({})
            
            return ChatResponse(
                response=response,
                function_used="screener",
                conversation_id=conversation_id,
                timestamp=datetime.now()
            )
        
        # Run comprehensive screening
        screening_result = await screening_service.screen_all_properties(include_property_data_only=False)
        
        if screening_result.get("success"):
            summary = screening_result.get("summary", "No summary available")
            num_docs = screening_result.get("documents_analyzed", 0)
            
            # Use LLM to generate a natural response based on the screening results
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a helpful real estate investment AI assistant. The user has run a comprehensive screening analysis on their documents. 

Present the screening results in a natural, conversational way that:
1. Highlights the key findings from the analysis
2. Provides actionable insights
3. Suggests next steps based on the results
4. Maintains a professional but friendly tone

Include the actual analysis summary and mention how many documents were analyzed."""),
                ("human", f"The screening analysis found: {summary}\n\nNumber of documents analyzed: {num_docs}")
            ])
            
            chain = prompt | llm | StrOutputParser()
            response = await chain.ainvoke({})
            
        else:
            error_msg = screening_result.get("error", "Unknown error occurred")
            # Use LLM to generate a natural error response
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful real estate investment AI assistant. The screening analysis failed. Provide a helpful, apologetic response that explains what went wrong and suggests what the user can do next."),
                ("human", f"The screening failed with error: {error_msg}")
            ])
            
            chain = prompt | fast_llm | StrOutputParser()
            response = await chain.ainvoke({})
        
        return ChatResponse(
            response=response,
            function_used="screener",
            conversation_id=conversation_id,
            timestamp=datetime.now(),
            memory_context={"documents_analyzed": len(doc_metadata)}
        )
        
    except Exception as e:
        error_response = f"❌ **Screening Error:** {str(e)}"
        return ChatResponse(
            response=error_response,
            function_used="screener",
            conversation_id=conversation_id,
            timestamp=datetime.now()
        )

async def handle_memory_command(request: ChatRequest, conversation_id: str) -> ChatResponse:
    """Handle @memory command - search memory for specific information"""
    try:
        # Extract search query from message
        message = request.message
        if "@memory" in message.lower():
            # Extract query after @memory
            parts = message.split("@memory", 1)
            if len(parts) > 1:
                query = parts[1].strip()
            else:
                query = "real estate investment"
        else:
            query = message
        
        # Search memory
        search_results = await document_memory.search_documents(query, limit=5)
        
        if not search_results:
            response = f"🔍 **Memory Search Results for: '{query}'**\n\n❌ No relevant documents found in memory."
        else:
            response = f"🔍 **Memory Search Results for: '{query}'**\n\n"
            
            for i, result in enumerate(search_results, 1):
                filename = result.get("filename", "Unknown")
                content_preview = result.get("content", "")[:200] + "..." if len(result.get("content", "")) > 200 else result.get("content", "")
                
                response += f"**{i}. {filename}**\n"
                response += f"📄 {content_preview}\n\n"
        
        return ChatResponse(
            response=response,
            function_used="memory_search",
            conversation_id=conversation_id,
            timestamp=datetime.now(),
            memory_context={"search_query": query, "results_count": len(search_results)}
        )
        
    except Exception as e:
        error_response = f"❌ **Memory Search Error:** {str(e)}"
        return ChatResponse(
            response=error_response,
            function_used="memory_search",
            conversation_id=conversation_id,
            timestamp=datetime.now()
        )

async def handle_help_command(request: ChatRequest, conversation_id: str) -> ChatResponse:
    """Handle @help command - show available commands"""
    help_text = """🤖 **AI AGENT COMMANDS**

**Available Commands:**
- `@screener` - Run comprehensive screening on all documents in memory
- `@memory [query]` - Search memory for specific information
- `@stats` - Show memory statistics and document counts
- `@help` - Show this help message

**Examples:**
- `@screener` - Analyze all your real estate documents
- `@memory market trends` - Find information about market trends
- `@memory financing options` - Search for financing information
- `@stats` - See how many documents you have stored

**Regular Chat:**
You can also just ask questions normally, and I'll help you with real estate investment advice based on the documents in your memory!

**Getting Started:**
1. Upload documents using the file upload endpoint
2. Use `@screener` to analyze them
3. Use `@memory` to search for specific information
4. Ask me questions about your investments!"""
    
    return ChatResponse(
        response=help_text,
        function_used="help",
        conversation_id=conversation_id,
        timestamp=datetime.now()
    )

async def handle_stats_command(request: ChatRequest, conversation_id: str) -> ChatResponse:
    """Handle @stats command - show memory statistics"""
    try:
        # Get memory statistics
        stats = await document_memory.get_document_stats()
        doc_metadata = await get_cached_document_metadata()
        
        response = f"""📊 **MEMORY STATISTICS**

📚 **Documents in Memory:** {stats.get('total_documents', 0)}
💾 **Total Size:** {stats.get('total_size_bytes', 0):,} bytes
📁 **Document Types:**
"""
        
        doc_types = stats.get('documents_by_type', {})
        for doc_type, count in doc_types.items():
            response += f"  - {doc_type}: {count} documents\n"
        
        if all_docs:
            response += f"\n📄 **Recent Documents:**\n"
            for i, doc in enumerate(all_docs[:5], 1):
                filename = doc.get('filename', 'Unknown')
                doc_type = doc.get('document_type', 'Unknown')
                response += f"  {i}. {filename} ({doc_type})\n"
        
        return ChatResponse(
            response=response,
            function_used="stats",
            conversation_id=conversation_id,
            timestamp=datetime.now(),
            memory_context=stats
        )
        
    except Exception as e:
        error_response = f"❌ **Stats Error:** {str(e)}"
        return ChatResponse(
            response=error_response,
            function_used="stats",
            conversation_id=conversation_id,
            timestamp=datetime.now()
        )

async def handle_regular_chat(request: ChatRequest, conversation_id: str) -> ChatResponse:
    """Handle regular chat - provide AI assistance with memory and conversation context"""
    try:
        # Get cached document metadata (much faster than full documents)
        doc_metadata = await get_cached_document_metadata()
        
        # Get conversation context
        conversation_history = conversation_context.get_conversation_context(conversation_id)
        
        # Analyze the user's message to determine if we should search memory
        message_lower = request.message.lower()
        should_search_memory = any(keyword in message_lower for keyword in [
            'table', 'csv', 'excel', 'data', 'trends', 'metrics', 'portfolio', 'income', 'expenses',
            'properties', 'rental', 'market', 'analysis', 'summarize', 'show me', 'tell me about',
            'what does', 'explain', 'breakdown', 'overview', 'summary'
        ])
        
        # If user is asking about specific content, let AI analyze metadata and find relevant documents
        if should_search_memory and doc_metadata:
            # Let AI analyze the user's query and document metadata to find relevant documents
            relevant_docs = await ai_analyze_document_relevance(request.message, doc_metadata)
            
            # If we found relevant documents, provide direct analysis
            if relevant_docs:
                # Create detailed context from relevant documents
                memory_context = f"\n\n**Relevant Documents Found ({len(relevant_docs)} documents):**\n"
                for doc in relevant_docs:
                    filename = doc.get('filename', 'Unknown')
                    doc_type = doc.get('document_type', 'Unknown')
                    content_preview = doc.get('content', '')[:500] + "..." if len(doc.get('content', '')) > 500 else doc.get('content', '')
                    memory_context += f"\n**{filename}** ({doc_type}):\n{content_preview}\n"
                
                # Create prompt for direct analysis with conversation context
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are a helpful real estate investment AI assistant. You have direct access to the user's documents and can analyze them directly.

Your role is to:
1. Analyze the provided documents directly and provide specific insights
2. Cross-reference information between different documents when relevant
3. Provide concrete data, numbers, and specific findings from the documents
4. Link related information across documents
5. Give actionable insights based on the actual data
6. Reference previous conversation context when relevant

Be specific, data-driven, and reference the actual content from the documents. Don't just suggest using commands - provide the analysis directly.

{conversation_context}

{memory_context}"""),
                    ("human", "{message}")
                ])
                
                # Choose appropriate LLM based on query complexity
                selected_llm = fast_llm if is_simple_query(request.message) else llm
                
                # Create chain
                chain = prompt | selected_llm | StrOutputParser()
                
                # Generate response
                response = await chain.ainvoke({
                    "message": request.message,
                    "conversation_context": conversation_history,
                    "memory_context": memory_context
                })
                
                return ChatResponse(
                    response=response,
                    function_used="direct_analysis",
                    conversation_id=conversation_id,
                    timestamp=datetime.now(),
                    memory_context={"documents_analyzed": len(relevant_docs), "ai_analysis": True}
                )
        
        # Fallback to regular chat with basic memory context
        memory_context = ""
        if request.include_memory:
            if doc_metadata:
                memory_context = f"\n\n**Available Documents in Memory ({len(doc_metadata)} documents):**\n"
                for doc in doc_metadata[:5]:  # Show first 5 documents
                    filename = doc.get('filename', 'Unknown')
                    doc_type = doc.get('document_type', 'Unknown')
                    memory_context += f"- {filename} ({doc_type})\n"
                if len(doc_metadata) > 5:
                    memory_context += f"- ... and {len(doc_metadata) - 5} more documents\n"
            else:
                memory_context = "\n\n**Available Documents in Memory: NONE - No documents are currently stored.**"
        
        # Create optimized prompt for regular chat with conversation context
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a real estate investment AI assistant with access to user documents.

IMPORTANT: Only mention documents that are explicitly listed in the memory context below. If no documents are listed, you have NO documents available and should clearly state this.

Provide helpful, concise advice. For specific data questions, analyze directly rather than suggesting commands.
Reference previous conversation context when relevant to provide better continuity.

Commands: @screener, @memory, @stats, @help

{conversation_context}

{memory_context}"""),
            ("human", "{message}")
        ])
        
        # Choose appropriate LLM based on query complexity
        selected_llm = fast_llm if is_simple_query(request.message) else llm
        
        # Create chain
        chain = prompt | selected_llm | StrOutputParser()
        
        # Generate response
        response = await chain.ainvoke({
            "message": request.message,
            "conversation_context": conversation_history,
            "memory_context": memory_context
        })
        
        return ChatResponse(
            response=response,
            function_used="regular_chat",
            conversation_id=conversation_id,
            timestamp=datetime.now(),
            memory_context={"documents_available": len(doc_metadata) if request.include_memory else 0}
        )
        
    except Exception as e:
        error_response = f"❌ **Chat Error:** {str(e)}"
        return ChatResponse(
            response=error_response,
            function_used="regular_chat",
            conversation_id=conversation_id,
            timestamp=datetime.now()
        )

@router.post("/search-memory", response_model=MemorySearchResponse)
async def search_memory(request: MemorySearchRequest):
    """
    Direct memory search endpoint
    """
    try:
        results = await document_memory.search_documents(request.query, limit=request.limit)
        
        return MemorySearchResponse(
            results=results,
            total_found=len(results),
            query=request.query
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory search error: {str(e)}")

@router.get("/conversation-stats")
async def get_conversation_stats():
    """Get conversation context statistics"""
    try:
        stats = conversation_context.get_conversation_stats()
        return {
            "success": True,
            "conversation_stats": stats,
            "configuration": {
                "max_messages_per_conversation": conversation_context.max_messages,
                "max_age_hours": conversation_context.max_age_hours,
                "max_tokens": conversation_context.max_tokens
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation stats: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for AI agent service"""
    try:
        # Check memory system
        memory_stats = await document_memory.get_document_stats()
        
        # Get conversation stats
        conv_stats = conversation_context.get_conversation_stats()
        
        return {
            "status": "healthy",
            "service": "ai_agent",
            "memory_system": {
                "available": True,
                "total_documents": memory_stats.get("total_documents", 0),
                "total_size_bytes": memory_stats.get("total_size_bytes", 0)
            },
            "conversation_context": {
                "enabled": True,
                "active_conversations": conv_stats["active_conversations"],
                "total_messages": conv_stats["total_messages"],
                "max_messages_per_conversation": conversation_context.max_messages,
                "max_age_hours": conversation_context.max_age_hours
            },
            "ai_model": "gemini-2.5-pro",
            "available_commands": ["@screener", "@memory", "@stats", "@help"]
        }
        
    except Exception as e:
        return {
            "status": "degraded",
            "service": "ai_agent",
            "error": str(e),
            "memory_system": {"available": False}
        }
