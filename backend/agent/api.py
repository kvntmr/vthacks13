"""
FastAPI wrapper for the Commercial Real Estate Due Diligence Agent

This module provides a REST API interface for the real estate agent,
allowing users to interact with it via HTTP requests.
"""

import os
import asyncio
from typing import Dict, Any, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

from real_estate_agent import RealEstateAgent, create_real_estate_agent


# Global agent instance
agent_instance: Optional[RealEstateAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifecycle of the FastAPI application."""
    global agent_instance
    
    # Startup: Initialize the agent
    print("Initializing Real Estate Agent...")
    try:
        agent_instance = create_real_estate_agent()
        print("✓ Real Estate Agent initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize agent: {e}")
        agent_instance = None
    
    yield
    
    # Shutdown: Clean up resources
    print("Shutting down Real Estate Agent...")


# Create FastAPI app with lifespan management
app = FastAPI(
    title="Commercial Real Estate Due Diligence API",
    description="""
    A specialized API for commercial real estate due diligence using government data from Data.gov.
    
    This API provides access to a LangChain-powered agent that can:
    - Search and analyze crime & safety data
    - Find zoning & planning information
    - Access construction & permit records
    - Retrieve environmental factors
    - Analyze demographics & economics
    - Examine transportation & infrastructure
    - Assess utilities & services
    
    All queries are processed by an AI agent that searches Data.gov datasets and provides
    comprehensive analysis for real estate investment decisions.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this more restrictively in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response validation
class QueryRequest(BaseModel):
    """Request model for agent queries."""
    question: str = Field(
        ..., 
        description="The question or request about real estate due diligence",
        example="What crime data is available for downtown Portland, Oregon?"
    )
    include_metadata: bool = Field(
        default=False,
        description="Whether to include detailed metadata in the response"
    )


class QueryResponse(BaseModel):
    """Response model for agent queries."""
    success: bool = Field(description="Whether the query was successful")
    response: str = Field(description="The agent's response to the query")
    message_count: Optional[int] = Field(description="Number of messages in the conversation")
    error: Optional[str] = Field(description="Error message if the query failed")
    metadata: Optional[Dict[str, Any]] = Field(description="Additional metadata if requested")


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str = Field(description="Service status")
    agent_ready: bool = Field(description="Whether the agent is initialized and ready")
    version: str = Field(description="API version")


class AgentInfoResponse(BaseModel):
    """Response model for agent information."""
    agent_type: str = Field(description="Type of agent")
    capabilities: List[str] = Field(description="List of agent capabilities")
    data_sources: List[str] = Field(description="Available data sources")
    focus_areas: List[str] = Field(description="Key focus areas for analysis")


# Dependency to get the agent instance
async def get_agent() -> RealEstateAgent:
    """Dependency to get the initialized agent instance."""
    if agent_instance is None:
        raise HTTPException(
            status_code=503, 
            detail="Real Estate Agent is not initialized. Please check the server logs."
        )
    return agent_instance


# API Routes
@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with basic API information."""
    return {
        "message": "Commercial Real Estate Due Diligence API",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if agent_instance is not None else "unhealthy",
        agent_ready=agent_instance is not None,
        version="1.0.0"
    )


@app.get("/agent/info", response_model=AgentInfoResponse)
async def get_agent_info():
    """Get information about the agent's capabilities."""
    return AgentInfoResponse(
        agent_type="Commercial Real Estate Due Diligence Agent",
        capabilities=[
            "Search Data.gov datasets",
            "Analyze crime and safety data",
            "Find zoning and planning information",
            "Access construction and permit records",
            "Retrieve environmental data",
            "Analyze demographics and economics",
            "Examine transportation infrastructure",
            "Assess utilities and services",
            "Download and process CSV/JSON datasets",
            "Provide data-driven insights for real estate decisions"
        ],
        data_sources=[
            "Data.gov (catalog.data.gov)",
            "Crime statistics",
            "Zoning records",
            "Building permits",
            "Environmental data",
            "Demographics",
            "Transportation data",
            "Utility information"
        ],
        focus_areas=[
            "Crime & Safety Data",
            "Zoning & Planning",
            "Construction & Permits", 
            "Environmental Factors",
            "Demographics & Economics",
            "Transportation & Infrastructure",
            "Utilities & Services"
        ]
    )


@app.post("/query/sync", response_model=QueryResponse)
async def query_agent_sync(
    request: QueryRequest,
    agent: RealEstateAgent = Depends(get_agent)
) -> QueryResponse:
    """
    Synchronous version of the query endpoint.
    
    This endpoint uses the synchronous query method, which may be more suitable
    for environments where async handling is challenging.
    """
    try:
        # Process the query using the synchronous method
        result = agent.query_sync(request.question)
        
        # Prepare the response
        response_data = {
            "success": result["success"],
            "response": result["response"],
            "message_count": result.get("message_count"),
            "error": result.get("error")
        }
        
        # Add metadata if requested
        if request.include_metadata and result.get("all_messages"):
            response_data["metadata"] = {
                "all_messages": [
                    {
                        "type": type(msg).__name__,
                        "content": str(msg.content) if hasattr(msg, 'content') else str(msg)
                    }
                    for msg in result["all_messages"]
                ],
                "query_timestamp": result.get("timestamp"),
                "processing_time": result.get("processing_time")
            }
        
        return QueryResponse(**response_data)
        
    except Exception as e:
        # Log the error (in production, use proper logging)
        print(f"Error processing sync query: {e}")
        
        return QueryResponse(
            success=False,
            response=f"An error occurred while processing your query: {str(e)}",
            error=str(e)
        )


# Example queries endpoint for documentation
@app.get("/examples")
async def get_example_queries():
    """Get example queries to help users understand the agent's capabilities."""
    return {
        "examples": [
            {
                "category": "Crime & Safety",
                "queries": [
                    "What crime data is available for downtown Portland, Oregon?",
                    "Find police incident reports for zip code 10001",
                    "Show me safety statistics for the Financial District in San Francisco"
                ]
            },
            {
                "category": "Zoning & Planning", 
                "queries": [
                    "What are the zoning restrictions for commercial development in Austin, Texas?",
                    "Find building permits issued in Manhattan in the last year",
                    "Show me development approvals for mixed-use projects in Seattle"
                ]
            },
            {
                "category": "Environmental",
                "queries": [
                    "What environmental data is available for a property near the Chicago River?",
                    "Find air quality measurements for Los Angeles County",
                    "Show me flood zone information for Miami-Dade County"
                ]
            },
            {
                "category": "Demographics & Economics",
                "queries": [
                    "What are the demographics of the area around 123 Main Street, Denver?",
                    "Find income and employment data for Boston neighborhoods",
                    "Show me business license activity in downtown Phoenix"
                ]
            },
            {
                "category": "Transportation & Infrastructure",
                "queries": [
                    "What transportation data is available for Times Square area?",
                    "Find traffic count data for major highways near our property",
                    "Show me public transit accessibility for this address"
                ]
            }
        ]
    }


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with proper error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions with proper error responses."""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "An internal server error occurred",
            "details": str(exc)
        }
    )
# Store statuses for multiple CSVs
# store this in a file
import json






@app.get("/csv-status")
def get_csv_status():
    # read csv_status.json
    with open("csv_status.json", "r") as f:
        csv_status = json.load(f)

    """
    Frontend polls this endpoint to get status of all CSVs.
    """
    return csv_status


if __name__ == "__main__":
    # Configuration for development
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    print(f"Starting Real Estate API server on {host}:{port}")
    print(f"Docs available at: http://{host}:{port}/docs")
    
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
