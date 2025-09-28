# Commercial Real Estate Due Diligence API

This API provides access to a specialized AI agent for commercial real estate due diligence using government data from Data.gov.

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set API Key
Set your Google API key as an environment variable:
```bash
export GOOGLE_API_KEY="your-google-api-key-here"
```

### 3. Start the Server
```bash
# Simple start
python start_api.py

# Or with custom configuration
python start_api.py --host 0.0.0.0 --port 8080 --reload

# Check dependencies only
python start_api.py --check-only
```

### 4. Access the API
- **API Documentation**: http://localhost:8000/docs
- **Interactive Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Core Endpoints

#### `POST /query`
Query the real estate agent with questions about due diligence.

**Request:**
```json
{
  "question": "What crime data is available for downtown Portland, Oregon?",
  "include_metadata": false
}
```

**Response:**
```json
{
  "success": true,
  "response": "I found several crime datasets for Portland, Oregon...",
  "message_count": 5,
  "error": null,
  "metadata": null
}
```

#### `POST /query/sync`
Synchronous version of the query endpoint.

#### `GET /health`
Check the health status of the API and agent.

#### `GET /agent/info`
Get information about the agent's capabilities and focus areas.

#### `GET /examples`
Get example queries to understand the agent's capabilities.

### Information Endpoints

#### `GET /`
Root endpoint with basic API information.

## Agent Capabilities

The agent specializes in analyzing these areas for commercial real estate:

### 1. Crime & Safety Data
- Crime statistics by location/zip code
- Police incident reports
- Public safety metrics
- Emergency response data

### 2. Zoning & Planning
- Zoning classifications and restrictions
- Land use regulations
- Development permits and approvals
- Planning commission records

### 3. Construction & Permits
- Building permits issued
- Construction activity trends
- Code violations and inspections
- Infrastructure projects

### 4. Environmental Factors
- Water quality reports
- Air quality measurements
- Soil contamination data
- Flood zone information
- Environmental impact assessments

### 5. Demographics & Economics
- Population demographics
- Income and employment data
- Business licenses and activity
- Tax assessment records

### 6. Transportation & Infrastructure
- Traffic patterns and counts
- Public transit accessibility
- Road conditions and maintenance
- Airport and transportation hubs

### 7. Utilities & Services
- Utility service areas
- Internet/broadband availability
- Public services coverage
- Emergency services access

## Example Queries

### Crime & Safety
```
"What crime data is available for downtown Portland, Oregon?"
"Find police incident reports for zip code 10001"
"Show me safety statistics for the Financial District in San Francisco"
```

### Zoning & Planning
```
"What are the zoning restrictions for commercial development in Austin, Texas?"
"Find building permits issued in Manhattan in the last year"
"Show me development approvals for mixed-use projects in Seattle"
```

### Environmental
```
"What environmental data is available for a property near the Chicago River?"
"Find air quality measurements for Los Angeles County"
"Show me flood zone information for Miami-Dade County"
```

### Demographics & Economics
```
"What are the demographics of the area around 123 Main Street, Denver?"
"Find income and employment data for Boston neighborhoods"
"Show me business license activity in downtown Phoenix"
```

### Transportation & Infrastructure
```
"What transportation data is available for Times Square area?"
"Find traffic count data for major highways near our property"
"Show me public transit accessibility for this address"
```

## Configuration

### Environment Variables
- `GOOGLE_API_KEY`: Required for the AI agent
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `RELOAD`: Enable auto-reload (default: true)

### Command Line Options
```bash
python start_api.py --help
```

## Development

### Running in Development Mode
```bash
python start_api.py --reload --log-level debug
```

### API Testing
Use the interactive documentation at `/docs` to test endpoints directly in your browser.

### Adding New Features
The API is built using FastAPI and wraps the `RealEstateAgent` class. To add new endpoints:

1. Add new routes to `api.py`
2. Create appropriate Pydantic models for request/response validation
3. Update this documentation

## Data Storage

The agent automatically saves retrieved data to the `AI_FILES/` directory for future reference and analysis. Files are saved in JSON format with timestamps.

## Error Handling

The API includes comprehensive error handling:
- HTTP exceptions return structured error responses
- Agent initialization failures are properly handled
- Invalid requests are validated using Pydantic models
- Internal errors are logged and return generic error messages

## CORS

CORS is enabled for all origins in development. Configure this more restrictively for production use.

## Support

For issues or questions about the API, check the logs and ensure:
1. All dependencies are installed
2. Google API key is properly set
3. The agent initializes successfully (check `/health`)
