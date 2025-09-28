"""
Shared Document Memory Instance
Ensures all modules use the same DocumentMemory instance to avoid data inconsistency
"""

from app.core.langchain.memory.document_memory import DocumentMemory

# Create a single shared instance
shared_document_memory = DocumentMemory()

def get_document_memory() -> DocumentMemory:
    """Get the shared document memory instance"""
    return shared_document_memory
