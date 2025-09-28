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
from visualization_agent import VisualizationAgent, create_visualization_agent
from integrated_agents_example import IntegratedRealEstateAnalysis


# Global agent instances
agent_instance: Optional[RealEstateAgent] = None
visualization_agent_instance: Optional[VisualizationAgent] = None
integrated_system: Optional[IntegratedRealEstateAnalysis] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifecycle of the FastAPI application."""
    global agent_instance, visualization_agent_instance, integrated_system
    
    # Startup: Initialize all agents
    print("Initializing agents...")
    
    # Initialize Real Estate Agent
    try:
        agent_instance = create_real_estate_agent()
        print("✓ Real Estate Agent initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize Real Estate Agent: {e}")
        agent_instance = None
    
    # Initialize Visualization Agent
    try:
        visualization_agent_instance = create_visualization_agent()
        print("✓ Visualization Agent initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize Visualization Agent: {e}")
        visualization_agent_instance = None
    
    # Initialize Integrated System
    try:
        integrated_system = IntegratedRealEstateAnalysis()
        print("✓ Integrated Analysis System initialized successfully")
    except Exception as e:
        print(f"✗ Failed to initialize Integrated System: {e}")
        integrated_system = None
    
    yield
    
    # Shutdown: Clean up resources
    print("Shutting down agents...")


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


class VisualizationRequest(BaseModel):
    """Request model for visualization queries."""
    request: str = Field(
        ..., 
        description="The visualization request or description",
        example="Create a bar chart showing crime rates by neighborhood"
    )
    data_context: Optional[str] = Field(
        default=None,
        description="Optional context about the data to be visualized"
    )
    include_metadata: bool = Field(
        default=False,
        description="Whether to include detailed metadata in the response"
    )


class VisualizationResponse(BaseModel):
    """Response model for visualization queries."""
    success: bool = Field(description="Whether the visualization was successful")
    response: str = Field(description="The agent's response with visualization details")
    mcp_connected: bool = Field(description="Whether MCP visualization server is connected")
    tools_available: bool = Field(description="Whether visualization tools are available")
    message_count: Optional[int] = Field(description="Number of messages in the conversation")
    error: Optional[str] = Field(description="Error message if the query failed")
    metadata: Optional[Dict[str, Any]] = Field(description="Additional metadata if requested")


class IntegratedAnalysisRequest(BaseModel):
    """Request model for integrated analysis (data + visualization)."""
    location: str = Field(
        ..., 
        description="Location to analyze (city, county, zip code, etc.)",
        example="Austin, TX"
    )
    analysis_focus: str = Field(
        default="comprehensive",
        description="Focus area for analysis",
        example="crime and safety"
    )
    include_metadata: bool = Field(
        default=False,
        description="Whether to include detailed metadata in the response"
    )


class IntegratedAnalysisResponse(BaseModel):
    """Response model for integrated analysis."""
    success: bool = Field(description="Whether the analysis was successful")
    location: str = Field(description="Location that was analyzed")
    analysis_focus: str = Field(description="Focus area of the analysis")
    data_analysis: Optional[Dict[str, Any]] = Field(description="Real estate data analysis results")
    visualizations: Optional[Dict[str, Any]] = Field(description="Visualization results")
    errors: List[str] = Field(description="List of any errors encountered")
    metadata: Optional[Dict[str, Any]] = Field(description="Additional metadata if requested")


class ToolsResponse(BaseModel):
    """Response model for available tools."""
    visualization_tools: List[str] = Field(description="Available visualization tools")
    mcp_connected: bool = Field(description="Whether MCP server is connected")
    server_url: str = Field(description="MCP server URL")


# Dependency functions to get agent instances
async def get_agent() -> RealEstateAgent:
    """Dependency to get the initialized agent instance."""
    if agent_instance is None:
        raise HTTPException(
            status_code=503, 
            detail="Real Estate Agent is not initialized. Please check the server logs."
        )
    return agent_instance


async def get_visualization_agent() -> VisualizationAgent:
    """Dependency to get the visualization agent instance."""
    if visualization_agent_instance is None:
        raise HTTPException(
            status_code=503, 
            detail="Visualization Agent is not initialized. Please check the server logs."
        )
    return visualization_agent_instance


async def get_integrated_system() -> IntegratedRealEstateAnalysis:
    """Dependency to get the integrated analysis system."""
    if integrated_system is None:
        raise HTTPException(
            status_code=503, 
            detail="Integrated Analysis System is not initialized. Please check the server logs."
        )
    return integrated_system


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
    Query endpoint for real estate analysis.
    
    This endpoint processes real estate queries using the agent's async method
    in a proper async context.
    """
    try:
        # Process the query using the async method
        result = await agent.query(request.question)
        
        # Prepare the response
        response_data = {
            "success": result["success"],
            "response": result["response"],
            "message_count": result.get("message_count"),
            "error": result.get("error"),
            "metadata": None  # Default to None
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
            message_count=None,
            error=str(e),
            metadata=None
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


# Visualization Agent Endpoints
@app.post("/visualization/query", response_model=VisualizationResponse)
async def query_visualization(
    request: VisualizationRequest,
    viz_agent: VisualizationAgent = Depends(get_visualization_agent)
) -> VisualizationResponse:
    """
    Query the visualization agent to create charts, graphs, and visualizations.
    
    This endpoint connects to the MCP visualization server and uses available
    tools to create meaningful visual representations of data.
    """
    try:
        result = await viz_agent.query(request.request, request.data_context)
        
        response_data = {
            "success": result.get("success", False),
            "response": result.get("response", ""),
            "mcp_connected": result.get("mcp_connected", False),
            "tools_available": result.get("tools_available", False),
            "message_count": result.get("message_count"),
            "error": result.get("error")
        }
        
        if request.include_metadata:
            response_data["metadata"] = {
                "all_messages": result.get("all_messages", []),
                "request_details": request.dict()
            }
        
        return VisualizationResponse(**response_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Visualization query failed: {str(e)}"
        )


@app.get("/visualization/tools", response_model=ToolsResponse)
async def get_visualization_tools(
    viz_agent: VisualizationAgent = Depends(get_visualization_agent)
) -> ToolsResponse:
    """
    Get list of available visualization tools from the MCP server.
    """
    try:
        tools = await viz_agent.get_available_tools()
        
        return ToolsResponse(
            visualization_tools=tools,
            mcp_connected=viz_agent.mcp_client is not None,
            server_url=viz_agent.mcp_server_url
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get visualization tools: {str(e)}"
        )


@app.get("/visualization/info", response_model=AgentInfoResponse)
async def get_visualization_agent_info() -> AgentInfoResponse:
    """
    Get information about the visualization agent's capabilities.
    """
    return AgentInfoResponse(
        agent_type="Visualization Agent",
        capabilities=[
            "Create interactive charts and graphs",
            "Generate heatmaps and geographic visualizations", 
            "Design dashboard layouts",
            "Recommend appropriate chart types",
            "Process various data formats",
            "Export visualizations in multiple formats"
        ],
        data_sources=[
            "MCP Visualization Server",
            "Real Estate Analysis Data",
            "CSV/JSON datasets",
            "API data feeds"
        ],
        focus_areas=[
            "Data visualization",
            "Interactive charts",
            "Statistical plots",
            "Geographic mapping",
            "Dashboard design",
            "Visual analytics"
        ]
    )


# Integrated Analysis Endpoints
@app.post("/integrated/analyze", response_model=IntegratedAnalysisResponse)
async def integrated_analysis(
    request: IntegratedAnalysisRequest,
    system: IntegratedRealEstateAnalysis = Depends(get_integrated_system)
) -> IntegratedAnalysisResponse:
    """
    Perform integrated real estate analysis with automatic visualizations.
    
    This endpoint combines the real estate data analysis agent with the visualization
    agent to provide comprehensive insights with accompanying charts and graphs.
    """
    try:
        result = await system.analyze_and_visualize(
            request.location, 
            request.analysis_focus
        )
        
        response_data = {
            "success": result.get("success", False),
            "location": result.get("location", ""),
            "analysis_focus": result.get("analysis_focus", ""),
            "data_analysis": result.get("data_analysis"),
            "visualizations": result.get("visualizations"),
            "errors": result.get("errors", [])
        }
        
        if request.include_metadata:
            response_data["metadata"] = {
                "request_details": request.dict(),
                "processing_info": {
                    "data_analysis_messages": result.get("data_analysis", {}).get("message_count", 0),
                    "visualization_messages": result.get("visualizations", {}).get("message_count", 0),
                    "mcp_connected": result.get("visualizations", {}).get("mcp_connected", False)
                }
            }
        
        return IntegratedAnalysisResponse(**response_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Integrated analysis failed: {str(e)}"
        )


@app.post("/integrated/crime-analysis", response_model=IntegratedAnalysisResponse)
async def integrated_crime_analysis(
    location: str,
    system: IntegratedRealEstateAnalysis = Depends(get_integrated_system)
) -> IntegratedAnalysisResponse:
    """
    Quick integrated analysis focused on crime and safety data with visualizations.
    """
    try:
        result = await system.quick_crime_analysis(location)
        
        return IntegratedAnalysisResponse(
            success=result.get("success", False),
            location=result.get("location", ""),
            analysis_focus=result.get("analysis_focus", ""),
            data_analysis=result.get("data_analysis"),
            visualizations=result.get("visualizations"),
            errors=result.get("errors", [])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Crime analysis failed: {str(e)}"
        )


@app.post("/integrated/market-analysis", response_model=IntegratedAnalysisResponse)
async def integrated_market_analysis(
    location: str,
    system: IntegratedRealEstateAnalysis = Depends(get_integrated_system)
) -> IntegratedAnalysisResponse:
    """
    Quick integrated analysis focused on demographics and market indicators with visualizations.
    """
    try:
        result = await system.demographic_market_analysis(location)
        
        return IntegratedAnalysisResponse(
            success=result.get("success", False),
            location=result.get("location", ""),
            analysis_focus=result.get("analysis_focus", ""),
            data_analysis=result.get("data_analysis"),
            visualizations=result.get("visualizations"),
            errors=result.get("errors", [])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Market analysis failed: {str(e)}"
        )


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
