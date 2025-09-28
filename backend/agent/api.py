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


class BatchAnalysisRequest(BaseModel):
    """Request model for batch analysis of multiple locations."""
    locations: List[str] = Field(
        ..., 
        description="List of locations to analyze",
        example=["Austin, TX", "Denver, CO", "Portland, OR"]
    )
    analysis_focus: str = Field(
        default="comprehensive",
        description="Focus area for analysis",
        example="crime and safety"
    )
    include_metadata: bool = Field(
        default=False,
        description="Whether to include detailed metadata in responses"
    )


class BatchAnalysisResponse(BaseModel):
    """Response model for batch analysis."""
    success: bool = Field(description="Whether the batch analysis was successful")
    total_locations: int = Field(description="Total number of locations processed")
    successful_analyses: int = Field(description="Number of successful analyses")
    failed_analyses: int = Field(description="Number of failed analyses")
    results: List[IntegratedAnalysisResponse] = Field(description="Individual analysis results")
    summary: Dict[str, Any] = Field(description="Summary of batch analysis")


class CustomAnalysisRequest(BaseModel):
    """Request model for custom analysis with flexible parameters."""
    location: str = Field(
        ..., 
        description="Location to analyze",
        example="Seattle, WA"
    )
    custom_query: str = Field(
        ...,
        description="Custom analysis query or focus area",
        example="zoning and development permits for mixed-use properties"
    )
    include_visualizations: bool = Field(
        default=True,
        description="Whether to generate visualizations for the analysis"
    )
    visualization_preferences: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Specific visualization preferences and requirements"
    )
    include_metadata: bool = Field(
        default=False,
        description="Whether to include detailed metadata in the response"
    )


class SystemStatusResponse(BaseModel):
    """Response model for integrated system status."""
    system_ready: bool = Field(description="Whether the integrated system is ready")
    real_estate_agent_status: str = Field(description="Status of the real estate agent")
    visualization_agent_status: str = Field(description="Status of the visualization agent")
    mcp_server_connected: bool = Field(description="Whether MCP server is connected")
    available_analysis_types: List[str] = Field(description="Available analysis types")
    system_capabilities: Dict[str, Any] = Field(description="System capabilities and features")


class AnalysisTypesResponse(BaseModel):
    """Response model for available analysis types."""
    predefined_types: List[Dict[str, str]] = Field(description="Predefined analysis types with descriptions")
    custom_supported: bool = Field(description="Whether custom analysis is supported")
    focus_areas: List[str] = Field(description="Available focus areas for analysis")
    examples: Dict[str, List[str]] = Field(description="Example queries for each analysis type")


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
        ],
        "integrated_analysis_examples": [
            {
                "endpoint": "/integrated/analyze",
                "description": "Comprehensive analysis with visualizations",
                "example_request": {
                    "location": "Austin, TX",
                    "analysis_focus": "comprehensive",
                    "include_metadata": True
                }
            },
            {
                "endpoint": "/integrated/custom-analysis",
                "description": "Custom analysis with flexible parameters",
                "example_request": {
                    "location": "Seattle, WA",
                    "custom_query": "zoning and development permits for mixed-use properties",
                    "include_visualizations": True,
                    "include_metadata": False
                }
            },
            {
                "endpoint": "/integrated/batch-analysis",
                "description": "Batch analysis for multiple locations",
                "example_request": {
                    "locations": ["Austin, TX", "Denver, CO", "Portland, OR"],
                    "analysis_focus": "crime and safety",
                    "include_metadata": False
                }
            },
            {
                "endpoint": "/integrated/crime-analysis",
                "description": "Quick crime analysis with visualizations",
                "example_request": {
                    "location": "San Francisco, CA"
                }
            },
            {
                "endpoint": "/integrated/market-analysis",
                "description": "Market demographics and economics analysis",
                "example_request": {
                    "location": "Miami, FL"
                }
            }
        ],
        "available_endpoints": {
            "basic_analysis": [
                "/query/sync - Synchronous real estate data analysis",
                "/visualization/query - Create visualizations and charts"
            ],
            "integrated_analysis": [
                "/integrated/analyze - Full integrated analysis with visualizations",
                "/integrated/custom-analysis - Custom analysis with flexible parameters",
                "/integrated/batch-analysis - Process multiple locations at once",
                "/integrated/crime-analysis - Focused crime and safety analysis",
                "/integrated/market-analysis - Demographics and market analysis"
            ],
            "system_info": [
                "/integrated/status - System health and component status",
                "/integrated/analysis-types - Available analysis types and examples",
                "/integrated/info - Detailed system capabilities",
                "/health - Basic API health check",
                "/agent/info - Real estate agent capabilities",
                "/visualization/info - Visualization agent capabilities"
            ]
        }
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


# Enhanced Integrated Analysis Endpoints
@app.get("/integrated/status", response_model=SystemStatusResponse)
async def get_integrated_system_status() -> SystemStatusResponse:
    """
    Get the status and health of the integrated analysis system.
    """
    try:
        # Check system components
        real_estate_ready = agent_instance is not None
        visualization_ready = visualization_agent_instance is not None
        integrated_ready = integrated_system is not None
        
        # Check MCP server connection
        mcp_connected = False
        if visualization_agent_instance:
            try:
                mcp_connected = visualization_agent_instance.mcp_client is not None
            except:
                mcp_connected = False
        
        return SystemStatusResponse(
            system_ready=integrated_ready and real_estate_ready and visualization_ready,
            real_estate_agent_status="ready" if real_estate_ready else "not initialized",
            visualization_agent_status="ready" if visualization_ready else "not initialized",
            mcp_server_connected=mcp_connected,
            available_analysis_types=[
                "comprehensive", "crime and safety", "demographics and economic indicators",
                "zoning and planning", "environmental factors", "transportation and infrastructure",
                "utilities and services", "custom"
            ],
            system_capabilities={
                "real_estate_analysis": real_estate_ready,
                "data_visualization": visualization_ready,
                "integrated_workflows": integrated_ready,
                "batch_processing": integrated_ready,
                "custom_analysis": integrated_ready,
                "mcp_visualization_tools": mcp_connected
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get system status: {str(e)}"
        )


@app.get("/integrated/analysis-types", response_model=AnalysisTypesResponse)
async def get_analysis_types() -> AnalysisTypesResponse:
    """
    Get available analysis types and their descriptions.
    """
    return AnalysisTypesResponse(
        predefined_types=[
            {
                "type": "comprehensive",
                "description": "Complete due diligence analysis covering all major factors"
            },
            {
                "type": "crime and safety",
                "description": "Focus on crime statistics, safety data, and security factors"
            },
            {
                "type": "demographics and economic indicators",
                "description": "Population demographics, income data, employment statistics"
            },
            {
                "type": "zoning and planning",
                "description": "Zoning regulations, development permits, planning restrictions"
            },
            {
                "type": "environmental factors",
                "description": "Environmental data, pollution levels, natural hazards"
            },
            {
                "type": "transportation and infrastructure",
                "description": "Transportation access, infrastructure quality, connectivity"
            },
            {
                "type": "utilities and services",
                "description": "Utility availability, service quality, municipal services"
            }
        ],
        custom_supported=True,
        focus_areas=[
            "Crime & Safety", "Demographics & Economics", "Zoning & Planning",
            "Environmental Factors", "Transportation & Infrastructure", "Utilities & Services",
            "Construction & Permits", "Market Trends", "Investment Risk Assessment"
        ],
        examples={
            "comprehensive": [
                "Austin, TX comprehensive analysis",
                "Complete due diligence for downtown Portland properties"
            ],
            "crime_and_safety": [
                "Crime data analysis for San Francisco Financial District",
                "Safety assessment for Chicago South Loop"
            ],
            "demographics": [
                "Market demographics for Miami Beach",
                "Population trends in Seattle neighborhoods"
            ],
            "custom": [
                "Flood risk assessment for Houston properties",
                "Tech industry impact on local real estate in Palo Alto"
            ]
        }
    )


@app.post("/integrated/custom-analysis", response_model=IntegratedAnalysisResponse)
async def custom_integrated_analysis(
    request: CustomAnalysisRequest,
    system: IntegratedRealEstateAnalysis = Depends(get_integrated_system)
) -> IntegratedAnalysisResponse:
    """
    Perform custom integrated analysis with user-defined focus and requirements.
    """
    try:
        # Prepare custom analysis parameters
        analysis_focus = request.custom_query
        
        if request.include_visualizations:
            # Use full integrated analysis
            result = await system.analyze_and_visualize(request.location, analysis_focus)
        else:
            # Use only data analysis (modify the query to skip visualization)
            query = f"""
            Please analyze {analysis_focus} for {request.location}.
            Find relevant datasets, save them to files, and provide analysis of key trends and insights.
            Focus on data that would be relevant for real estate investment decisions.
            """
            result = {
                "location": request.location,
                "analysis_focus": analysis_focus,
                "data_analysis": await system.real_estate_agent.query(query),
                "visualizations": None,
                "success": True,
                "errors": []
            }
        
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
                "custom_query": request.custom_query,
                "visualization_included": request.include_visualizations,
                "visualization_preferences": request.visualization_preferences
            }
        
        return IntegratedAnalysisResponse(**response_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Custom analysis failed: {str(e)}"
        )


@app.get("/integrated/info", response_model=AgentInfoResponse)
async def get_integrated_system_info() -> AgentInfoResponse:
    """
    Get detailed information about the integrated analysis system capabilities.
    """
    return AgentInfoResponse(
        agent_type="Integrated Real Estate Analysis System",
        capabilities=[
            "Comprehensive multi-source data analysis",
            "Automated visualization generation", 
            "Real estate due diligence workflows",
            "Crime and safety data analysis",
            "Demographics and market research",
            "Zoning and planning information",
            "Environmental impact assessment",
            "Transportation and infrastructure analysis",
            "Batch processing for multiple locations",
            "Custom analysis with flexible parameters",
            "Data export and visualization export",
            "Interactive dashboard creation"
        ],
        data_sources=[
            "Data.gov datasets",
            "Crime statistics databases",
            "Census and demographic data",
            "Zoning and permit records",
            "Environmental monitoring data",
            "Transportation and infrastructure data",
            "Economic indicators",
            "Market trend data"
        ],
        focus_areas=[
            "Integrated Real Estate Analysis",
            "Data-Driven Decision Making",
            "Risk Assessment",
            "Market Intelligence",
            "Location Analytics",
            "Investment Due Diligence",
            "Visual Data Presentation",
            "Automated Reporting"
        ]
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
