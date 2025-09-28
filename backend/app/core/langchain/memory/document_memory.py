"""
Document Memory System using LangChain
Stores and retrieves parsed file content for AI agents
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
from dotenv import load_dotenv

load_dotenv()

class DocumentType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    CSV = "csv"
    TXT = "txt"
    RTF = "rtf"
    ODT = "odt"

@dataclass
class DocumentMetadata:
    """Metadata for stored documents"""
    document_id: str
    filename: str
    document_type: DocumentType
    upload_timestamp: datetime
    file_size: int
    source: str
    extracted_property_data: Optional[Dict[str, Any]] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []

class DocumentMemory:
    """Memory system for storing and retrieving parsed document content"""
    
    def __init__(self, persist_directory: str = "./chroma_db"):
        """
        Initialize the document memory system
        
        Args:
            persist_directory: Directory to persist the vector store
        """
        self.persist_directory = persist_directory
        
        # Initialize embeddings
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
        
        # Initialize vector store
        self.vectorstore = Chroma(
            persist_directory=persist_directory,
            embedding_function=self.embeddings
        )
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        
        # In-memory storage for document metadata
        self.document_metadata: Dict[str, DocumentMetadata] = {}
        
        # Rebuild metadata from ChromaDB on initialization
        self._rebuild_metadata_from_chromadb()
    
    def _rebuild_metadata_from_chromadb(self):
        """
        Rebuild in-memory metadata from ChromaDB on initialization
        This ensures consistency after server restarts
        """
        try:
            collection = self.vectorstore._collection
            if not collection:
                return
            
            # Get all documents from ChromaDB
            all_docs = collection.get()
            if not all_docs or 'metadatas' not in all_docs:
                return
            
            # Extract unique document IDs and rebuild metadata
            unique_doc_ids = set()
            for metadata in all_docs['metadatas']:
                if metadata and 'document_id' in metadata:
                    unique_doc_ids.add(metadata['document_id'])
            
            # Rebuild metadata for each unique document
            for document_id in unique_doc_ids:
                # Get first chunk to extract metadata
                filter_dict = {"document_id": document_id}
                results = self.vectorstore.similarity_search(
                    "document",  # Generic query
                    k=1,  # Just get one chunk for metadata
                    filter=filter_dict
                )
                
                if results:
                    chunk_metadata = results[0].metadata
                    
                    # Recreate DocumentMetadata object
                    doc_metadata = DocumentMetadata(
                        document_id=document_id,
                        filename=chunk_metadata.get("filename", "Unknown"),
                        document_type=DocumentType(chunk_metadata.get("document_type", "txt")),
                        upload_timestamp=datetime.fromisoformat(
                            chunk_metadata.get("upload_timestamp", datetime.now().isoformat())
                        ),
                        file_size=chunk_metadata.get("file_size", 0),
                        source=chunk_metadata.get("source", "unknown"),
                        tags=json.loads(chunk_metadata.get("tags", "[]")) if isinstance(chunk_metadata.get("tags"), str) else chunk_metadata.get("tags", [])
                    )
                    
                    # Store in in-memory metadata
                    self.document_metadata[document_id] = doc_metadata
                    
        except Exception as e:
            # Log error but don't fail initialization
            print(f"Warning: Failed to rebuild metadata from ChromaDB: {e}")
    
    async def store_document(
        self,
        content: str,
        filename: str,
        document_type: DocumentType,
        file_size: int,
        source: str = "upload",
        extracted_property_data: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ) -> str:
        """
        Store a document in memory
        
        Args:
            content: Parsed text content from the document
            filename: Original filename
            document_type: Type of document
            file_size: Size of the original file in bytes
            source: Source of the document (upload, api, etc.)
            extracted_property_data: Extracted property data if available
            tags: Optional tags for the document
            
        Returns:
            Document ID for future reference
        """
        # Generate unique document ID
        document_id = str(uuid.uuid4())
        
        # Create metadata
        metadata = DocumentMetadata(
            document_id=document_id,
            filename=filename,
            document_type=document_type,
            upload_timestamp=datetime.now(),
            file_size=file_size,
            source=source,
            extracted_property_data=extracted_property_data,
            tags=tags or []
        )
        
        # Store metadata
        self.document_metadata[document_id] = metadata
        
        # Split content into chunks
        chunks = self.text_splitter.split_text(content)
        
        # Create documents with metadata
        documents = []
        for i, chunk in enumerate(chunks):
            doc = Document(
                page_content=chunk,
                metadata={
                    "document_id": document_id,
                    "filename": filename,
                    "document_type": document_type.value,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "source": source,
                    "upload_timestamp": metadata.upload_timestamp.isoformat(),
                    "tags": json.dumps(metadata.tags),
                    "has_property_data": extracted_property_data is not None
                }
            )
            documents.append(doc)
        
        # Add to vector store
        self.vectorstore.add_documents(documents)
        
        return document_id
    
    async def search_documents(
        self,
        query: str,
        document_type: Optional[DocumentType] = None,
        limit: int = 5,
        include_property_data: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Search for documents based on content similarity
        
        Args:
            query: Search query
            document_type: Filter by document type
            limit: Maximum number of results
            include_property_data: Whether to include extracted property data
            
        Returns:
            List of matching documents with metadata
        """
        # Build filter
        filter_dict = {}
        if document_type:
            filter_dict["document_type"] = document_type.value
        if not include_property_data:
            filter_dict["has_property_data"] = False
        
        # Search vector store
        results = self.vectorstore.similarity_search_with_score(
            query, 
            k=limit,
            filter=filter_dict if filter_dict else None
        )
        
        # Format results
        formatted_results = []
        for doc, score in results:
            document_id = doc.metadata.get("document_id")
            metadata = self.document_metadata.get(document_id)
            
            if metadata:
                result = {
                    "document_id": document_id,
                    "filename": metadata.filename,
                    "document_type": metadata.document_type.value,
                    "content": doc.page_content,
                    "similarity_score": score,
                    "upload_timestamp": metadata.upload_timestamp.isoformat(),
                    "tags": metadata.tags,
                    "chunk_index": doc.metadata.get("chunk_index"),
                    "total_chunks": doc.metadata.get("total_chunks")
                }
                
                if include_property_data and metadata.extracted_property_data:
                    result["extracted_property_data"] = metadata.extracted_property_data
                
                formatted_results.append(result)
        
        return formatted_results
    
    async def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a complete document by ID
        
        Args:
            document_id: Document ID
            
        Returns:
            Complete document with all chunks combined
        """
        # Get all chunks for this document from ChromaDB
        filter_dict = {"document_id": document_id}
        results = self.vectorstore.similarity_search(
            "document",  # Generic query to get documents
            k=1000,  # Large number to get all chunks
            filter=filter_dict
        )
        
        if not results:
            return None
        
        # Sort chunks by index and combine
        chunks = sorted(results, key=lambda x: x.metadata.get("chunk_index", 0))
        combined_content = "\n".join([chunk.page_content for chunk in chunks])
        
        # Get metadata from first chunk
        first_chunk = chunks[0]
        metadata = first_chunk.metadata
        
        # Parse tags if they're stored as JSON string
        tags = metadata.get("tags", "[]")
        if isinstance(tags, str):
            try:
                import json
                tags = json.loads(tags)
            except:
                tags = []
        
        return {
            "document_id": document_id,
            "filename": metadata.get("filename", "Unknown"),
            "document_type": metadata.get("document_type", "unknown"),
            "content": combined_content,
            "upload_timestamp": metadata.get("upload_timestamp", ""),
            "file_size": metadata.get("file_size", 0),
            "source": metadata.get("source", "unknown"),
            "tags": tags,
            "extracted_property_data": None  # This would need to be stored separately
        }
    
    async def get_all_documents(self, include_property_data: bool = False) -> List[Dict[str, Any]]:
        """
        Get all stored documents
        
        Args:
            include_property_data: Whether to include extracted property data
            
        Returns:
            List of all documents
        """
        documents = []
        
        # Get all unique document IDs from ChromaDB
        collection = self.vectorstore._collection
        if not collection:
            return documents
        
        # Get all documents from the collection
        all_docs = collection.get()
        if not all_docs or 'metadatas' not in all_docs:
            return documents
        
        # Extract unique document IDs
        unique_doc_ids = set()
        for metadata in all_docs['metadatas']:
            if metadata and 'document_id' in metadata:
                unique_doc_ids.add(metadata['document_id'])
        
        # Get document info for each unique ID
        for document_id in unique_doc_ids:
            # Get all chunks for this document to reconstruct content
            filter_dict = {"document_id": document_id}
            results = self.vectorstore.similarity_search(
                "document",  # Generic query
                k=1000,  # Get all chunks for this document
                filter=filter_dict
            )
            
            if results:
                # Sort chunks by chunk_index to maintain order
                sorted_chunks = sorted(results, key=lambda x: x.metadata.get("chunk_index", 0))
                
                # Reconstruct content from chunks
                content_parts = []
                for chunk in sorted_chunks:
                    content_parts.append(chunk.page_content)
                
                full_content = "\n".join(content_parts)
                
                # Get metadata from first chunk
                metadata = sorted_chunks[0].metadata
                
                # Create document info
                doc_info = {
                    "document_id": document_id,
                    "filename": metadata.get("filename", "Unknown"),
                    "document_type": metadata.get("document_type", "unknown"),
                    "file_size": metadata.get("file_size", 0),
                    "upload_timestamp": metadata.get("upload_timestamp", ""),
                    "source": metadata.get("source", "unknown"),
                    "tags": metadata.get("tags", "[]"),
                    "content": full_content
                }
                
                # Parse tags if they're stored as JSON string
                if isinstance(doc_info["tags"], str):
                    try:
                        import json
                        doc_info["tags"] = json.loads(doc_info["tags"])
                    except:
                        doc_info["tags"] = []
                
                documents.append(doc_info)
        
        return documents
    
    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document from memory
        
        Args:
            document_id: Document ID to delete
            
        Returns:
            True if deleted successfully, False otherwise
        """
        if document_id not in self.document_metadata:
            return False
        
        try:
            # Get document metadata before deletion
            metadata = self.document_metadata[document_id]
            
            # Remove from metadata
            del self.document_metadata[document_id]
            
            # Remove from vector store using ChromaDB's delete method
            # We need to get the collection and delete by metadata filter
            collection = self.vectorstore._collection
            if collection:
                # Delete all chunks for this document
                collection.delete(
                    where={"document_id": document_id}
                )
            
            return True
            
        except Exception as e:
            # If vector store deletion fails, at least remove from metadata
            print(f"Warning: Failed to delete from vector store: {str(e)}")
            return True  # Still consider it successful since metadata is removed
    
    async def delete_documents_by_ids(self, document_ids: List[str]) -> Dict[str, Any]:
        """
        Delete multiple documents by their IDs
        
        Args:
            document_ids: List of document IDs to delete
            
        Returns:
            Dictionary with deletion results including:
            - success: bool
            - deleted_count: int
            - deleted_documents: List[str] (IDs of successfully deleted documents)
            - failed_documents: List[Dict] (IDs and error messages for failed deletions)
            - message: str
        """
        if not document_ids:
            return {
                "success": True,
                "deleted_count": 0,
                "deleted_documents": [],
                "failed_documents": [],
                "message": "No document IDs provided"
            }
        
        deleted_count = 0
        deleted_documents = []
        failed_documents = []
        
        # Get collection for batch operations
        collection = self.vectorstore._collection
        
        for document_id in document_ids:
            try:
                # Check if document exists in ChromaDB (since we're not relying on in-memory metadata)
                if collection:
                    # Check if document exists by trying to get it
                    filter_dict = {"document_id": document_id}
                    results = self.vectorstore.similarity_search(
                        "document",  # Generic query
                        k=1,  # Just need to check if it exists
                        filter=filter_dict
                    )
                    
                    if not results:
                        failed_documents.append({
                            "document_id": document_id,
                            "error": "Document not found"
                        })
                        continue
                
                # Remove from in-memory metadata if it exists
                if document_id in self.document_metadata:
                    del self.document_metadata[document_id]
                
                # Remove from vector store
                if collection:
                    collection.delete(
                        where={"document_id": document_id}
                    )
                
                deleted_documents.append(document_id)
                deleted_count += 1
                
            except Exception as e:
                failed_documents.append({
                    "document_id": document_id,
                    "error": str(e)
                })
        
        # Determine overall success
        success = len(failed_documents) == 0
        
        return {
            "success": success,
            "deleted_count": deleted_count,
            "deleted_documents": deleted_documents,
            "failed_documents": failed_documents,
            "message": f"Successfully deleted {deleted_count} out of {len(document_ids)} documents"
        }
    
    async def delete_documents_by_filter(
        self, 
        filename: str = None,
        document_type: DocumentType = None,
        source: str = None,
        tags: List[str] = None,
        older_than_days: int = None
    ) -> Dict[str, Any]:
        """
        Delete multiple documents based on filters
        
        Args:
            filename: Delete documents with this filename
            document_type: Delete documents of this type
            source: Delete documents from this source
            tags: Delete documents with any of these tags
            older_than_days: Delete documents older than this many days
            
        Returns:
            Dictionary with deletion results
        """
        from datetime import datetime, timedelta
        
        deleted_count = 0
        deleted_documents = []
        errors = []
        
        # Get current time for age filtering
        cutoff_time = None
        if older_than_days:
            cutoff_time = datetime.now() - timedelta(days=older_than_days)
        
        # Find documents to delete
        documents_to_delete = []
        for doc_id, metadata in self.document_metadata.items():
            should_delete = True
            
            # Apply filters
            if filename and metadata.filename != filename:
                should_delete = False
            if document_type and metadata.document_type != document_type:
                should_delete = False
            if source and metadata.source != source:
                should_delete = False
            if tags and not any(tag in metadata.tags for tag in tags):
                should_delete = False
            if cutoff_time and metadata.upload_timestamp > cutoff_time:
                should_delete = False
            
            if should_delete:
                documents_to_delete.append(doc_id)
        
        # Delete each document
        for doc_id in documents_to_delete:
            try:
                success = await self.delete_document(doc_id)
                if success:
                    deleted_count += 1
                    deleted_documents.append({
                        "document_id": doc_id,
                        "filename": self.document_metadata.get(doc_id, {}).get("filename", "Unknown")
                    })
            except Exception as e:
                errors.append(f"Failed to delete {doc_id}: {str(e)}")
        
        return {
            "deleted_count": deleted_count,
            "deleted_documents": deleted_documents,
            "errors": errors,
            "total_found": len(documents_to_delete)
        }
    
    async def clear_all_documents(self) -> Dict[str, Any]:
        """
        Delete all documents from memory
        
        Returns:
            Dictionary with deletion results
        """
        try:
            # Get count before deletion from ChromaDB
            collection = self.vectorstore._collection
            if not collection:
                return {
                    "success": False,
                    "deleted_count": 0,
                    "deleted_size_bytes": 0,
                    "message": "No collection available"
                }
            
            # Get all documents from ChromaDB to count them
            all_docs = collection.get()
            total_documents = len(all_docs.get('ids', [])) if all_docs else 0
            
            # Clear metadata (in-memory)
            self.document_metadata.clear()
            
            # Clear vector store - delete all documents
            if total_documents > 0:
                # Get all document IDs and delete them
                all_ids = all_docs.get('ids', [])
                if all_ids:
                    collection.delete(ids=all_ids)
                else:
                    # Fallback: try to delete with empty where clause
                    collection.delete(where={})
            
            return {
                "success": True,
                "deleted_count": total_documents,
                "deleted_size_bytes": 0,  # Size calculation would be complex
                "message": f"Successfully deleted {total_documents} documents"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clear all documents: {str(e)}"
            }
    
    async def cleanup_orphaned_documents(self) -> Dict[str, Any]:
        """
        Clean up documents that exist in vector store but not in metadata
        (This can happen if metadata is lost but vector store persists)
        
        Returns:
            Dictionary with cleanup results
        """
        try:
            # Get all document IDs from vector store
            collection = self.vectorstore._collection
            if not collection:
                return {"success": True, "cleaned_count": 0, "message": "No collection found"}
            
            # Get all documents from vector store
            all_docs = collection.get()
            vector_doc_ids = set()
            
            if all_docs and 'metadatas' in all_docs:
                for metadata in all_docs['metadatas']:
                    if metadata and 'document_id' in metadata:
                        vector_doc_ids.add(metadata['document_id'])
            
            # Find orphaned documents (in vector store but not in metadata)
            metadata_doc_ids = set(self.document_metadata.keys())
            orphaned_ids = vector_doc_ids - metadata_doc_ids
            
            # Delete orphaned documents from vector store
            cleaned_count = 0
            for doc_id in orphaned_ids:
                try:
                    collection.delete(where={"document_id": doc_id})
                    cleaned_count += 1
                except Exception as e:
                    print(f"Failed to delete orphaned document {doc_id}: {str(e)}")
            
            return {
                "success": True,
                "cleaned_count": cleaned_count,
                "orphaned_ids": list(orphaned_ids),
                "message": f"Cleaned up {cleaned_count} orphaned documents"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to cleanup orphaned documents: {str(e)}"
            }
    
    async def get_document_stats(self) -> Dict[str, Any]:
        """
        Get statistics about stored documents
        
        Returns:
            Dictionary with document statistics
        """
        total_documents = len(self.document_metadata)
        total_size = sum(meta.file_size for meta in self.document_metadata.values())
        
        # Count by document type
        type_counts = {}
        for meta in self.document_metadata.values():
            doc_type = meta.document_type.value
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        
        # Count documents with property data
        with_property_data = sum(
            1 for meta in self.document_metadata.values() 
            if meta.extracted_property_data is not None
        )
        
        return {
            "total_documents": total_documents,
            "total_size_bytes": total_size,
            "documents_by_type": type_counts,
            "documents_with_property_data": with_property_data,
            "documents_without_property_data": total_documents - with_property_data
        }

