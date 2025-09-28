# Commercial Real Estate Due Diligence API Documentation

## Overview

The Commercial Real Estate Due Diligence API is a FastAPI-based web service that provides access to a specialized AI agent for commercial real estate analysis. The agent leverages government data from Data.gov to provide comprehensive due diligence information for real estate investment decisions.

## Features

- **AI-Powered Analysis**: LangChain-powered agent for intelligent data processing
- **Government Data Integration**: Direct access to Data.gov datasets
- **RESTful API**: Clean, documented REST endpoints
- **Real-time Processing**: Synchronous query processing with detailed responses
- **CORS Enabled**: Cross-origin requests supported for web applications
- **Comprehensive Error Handling**: Robust error responses and status codes
- **Interactive Documentation**: Auto-generated Swagger/OpenAPI docs

## Architecture

The API is built using:
- **FastAPI**: Modern, fast web framework for building APIs
- **Pydantic**: Data validation using Python type annotations
- **Uvicorn**: ASGI server for production deployment
- **LangChain**: Agent framework for AI-powered data processing

## Installation & Setup

### Prerequisites

- Python 3.8+
- Required dependencies (see `requirements.txt`)

### Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd backend/agent

# Install dependencies
pip install -r requirements.txt

# Set environment variables (optional)
export HOST=0.0.0.0
export PORT=8000
export RELOAD=true
```

### Running the API

#### Development Mode

```bash
# Using the main script
python api.py

# Or using uvicorn directly
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

#### Production Mode

```bash
# Using the start script
python start_api.py

# Or using uvicorn for production
uvicorn api:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- **API Server**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### 1. Root Endpoint

**GET /** 

Basic API information and navigation links.

**Response:**
```json
{
  "message": "Commercial Real Estate Due Diligence API",
  "docs": "/docs",
  "health": "/health",
  "version": "1.0.0"
}
```

### 2. Health Check

**GET /health**

Check the health status of the API and agent readiness.

**Response Model:** `HealthResponse`
```json
{
  "status": "healthy",
  "agent_ready": true,
  "version": "1.0.0"
}
```

**Status Values:**
- `healthy`: Agent is initialized and ready
- `unhealthy`: Agent initialization failed

### 3. Agent Information

**GET /agent/info**

Get detailed information about the agent's capabilities and data sources.

**Response Model:** `AgentInfoResponse`
```json
{
  "agent_type": "Commercial Real Estate Due Diligence Agent",
  "capabilities": [
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
  "data_sources": [
    "Data.gov (catalog.data.gov)",
    "Crime statistics",
    "Zoning records",
    "Building permits",
    "Environmental data",
    "Demographics",
    "Transportation data",
    "Utility information"
  ],
  "focus_areas": [
    "Crime & Safety Data",
    "Zoning & Planning",
    "Construction & Permits",
    "Environmental Factors",
    "Demographics & Economics",
    "Transportation & Infrastructure",
    "Utilities & Services"
  ]
}
```

### 4. Synchronous Query

**POST /query/sync**

Submit a question to the real estate agent and get a synchronous response.

**Request Model:** `QueryRequest`
```json
{
  "question": "What crime data is available for downtown Portland, Oregon?",
  "include_metadata": false
}
```

**Request Parameters:**
- `question` (string, required): The question about real estate due diligence
- `include_metadata` (boolean, optional): Whether to include detailed metadata in response (default: false)

**Response Model:** `QueryResponse`
```json
{
  "success": true,
  "response": "Based on my search of Data.gov datasets...",
  "message_count": 5,
  "error": null,
  "metadata": {
    "all_messages": [...],
    "query_timestamp": "2024-01-15T10:30:00Z",
    "processing_time": 2.5
  }
}
```

**Response Fields:**
- `success` (boolean): Whether the query was successful
- `response` (string): The agent's response to the query
- `message_count` (integer, optional): Number of messages in the conversation
- `error` (string, optional): Error message if the query failed
- `metadata` (object, optional): Additional metadata when `include_metadata=true`

### 5. Example Queries

**GET /examples**

Get example queries organized by category to understand the agent's capabilities.

**Response:**
```json
{
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
    }
  ]
}
```

### 6. CSV Status

**GET /csv-status**

Get the processing status of CSV files. This endpoint reads from `csv_status.json`.

**Response:** Variable based on current CSV processing status.

## Request/Response Models

### QueryRequest
```python
class QueryRequest(BaseModel):
    question: str  # Required: The question about real estate due diligence
    include_metadata: bool = False  # Optional: Include detailed metadata
```

### QueryResponse
```python
class QueryResponse(BaseModel):
    success: bool  # Whether the query was successful
    response: str  # The agent's response
    message_count: Optional[int]  # Number of messages in conversation
    error: Optional[str]  # Error message if failed
    metadata: Optional[Dict[str, Any]]  # Additional metadata
```

### HealthResponse
```python
class HealthResponse(BaseModel):
    status: str  # "healthy" or "unhealthy"
    agent_ready: bool  # Whether agent is initialized
    version: str  # API version
```

### AgentInfoResponse
```python
class AgentInfoResponse(BaseModel):
    agent_type: str  # Type of agent
    capabilities: List[str]  # List of capabilities
    data_sources: List[str]  # Available data sources
    focus_areas: List[str]  # Key focus areas
```

## Error Handling

The API includes comprehensive error handling:

### HTTP Exceptions
- **503 Service Unavailable**: Agent not initialized
- **422 Unprocessable Entity**: Invalid request data
- **500 Internal Server Error**: General server errors

### Error Response Format
```json
{
  "success": false,
  "error": "Error description",
  "status_code": 500,
  "details": "Additional error details"
}
```

## Usage Examples

### Basic Query
```bash
curl -X POST "http://localhost:8000/query/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What crime data is available for downtown Seattle?"
  }'
```

### Query with Metadata
```bash
curl -X POST "http://localhost:8000/query/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Find zoning information for Austin, Texas",
    "include_metadata": true
  }'
```

### Health Check
```bash
curl http://localhost:8000/health
```

### Get Agent Info
```bash
curl http://localhost:8000/agent/info
```

## Python Client Example

```python
import requests

# Base URL
base_url = "http://localhost:8000"

# Check health
health = requests.get(f"{base_url}/health")
print(f"API Status: {health.json()['status']}")

# Query the agent
query_data = {
    "question": "What environmental data is available for properties near the Chicago River?",
    "include_metadata": False
}

response = requests.post(f"{base_url}/query/sync", json=query_data)
result = response.json()

if result["success"]:
    print("Agent Response:", result["response"])
else:
    print("Error:", result["error"])
```

## Agent Capabilities

The real estate agent specializes in analyzing:

1. **Crime & Safety Data**
   - Police incident reports
   - Crime statistics by area
   - Safety ratings and trends

2. **Zoning & Planning**
   - Zoning restrictions and classifications
   - Development approvals
   - Land use regulations

3. **Construction & Permits**
   - Building permits
   - Construction activity
   - Development timelines

4. **Environmental Factors**
   - Air and water quality
   - Flood zones
   - Environmental hazards

5. **Demographics & Economics**
   - Population statistics
   - Income and employment data
   - Business activity

6. **Transportation & Infrastructure**
   - Traffic patterns
   - Public transit access
   - Highway and road data

7. **Utilities & Services**
   - Utility availability
   - Service coverage
   - Infrastructure quality

## Configuration

### Environment Variables

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `RELOAD`: Enable auto-reload in development (default: true)

### CORS Configuration

The API is configured with permissive CORS settings for development:
```python
allow_origins=["*"]  # Configure restrictively in production
allow_credentials=True
allow_methods=["*"]
allow_headers=["*"]
```

**Note**: Restrict CORS origins in production environments.

## Monitoring & Logging

- Health check endpoint for monitoring
- Console logging for development
- Error tracking with detailed exception handling
- Request/response validation

## Development & Testing

### Interactive Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Testing Endpoints
Use the interactive documentation or tools like:
- curl
- Postman
- HTTPie
- Python requests library

## Production Considerations

1. **Security**: Restrict CORS origins
2. **Performance**: Use multiple workers with uvicorn
3. **Monitoring**: Implement proper logging and metrics
4. **Error Handling**: Add structured logging
5. **Rate Limiting**: Consider adding rate limiting middleware
6. **Authentication**: Add authentication if needed

## Troubleshooting

### Common Issues

1. **Agent Not Initialized (503 Error)**
   - Check server logs for initialization errors
   - Verify dependencies are installed
   - Ensure Data.gov API access

2. **Query Timeout**
   - Large datasets may take time to process
   - Consider implementing async processing for long queries

3. **Invalid Request (422 Error)**
   - Check request format matches Pydantic models
   - Ensure required fields are provided

### Logs

Check console output for:
- Agent initialization status
- Query processing errors
- General application errors

## Support

For issues and questions:
1. Check the interactive documentation at `/docs`
2. Review example queries at `/examples`
3. Monitor health status at `/health`
4. Check server logs for detailed error information
