# Integrated Agents API Endpoints

This document describes the comprehensive API endpoints created for the integrated agents example in `api.py`. These endpoints combine the Real Estate Agent and Visualization Agent to provide powerful, integrated analysis capabilities.

## Overview

The integrated API endpoints provide:
- Comprehensive real estate analysis with automatic visualizations
- Batch processing for multiple locations
- Custom analysis with flexible parameters
- System health monitoring and status
- Detailed capability information

## Endpoints Summary

### Core Analysis Endpoints

#### 1. `/integrated/analyze` (POST)
**Purpose**: Perform comprehensive integrated analysis with visualizations

**Request Model**: `IntegratedAnalysisRequest`
```json
{
  "location": "Austin, TX",
  "analysis_focus": "comprehensive",
  "include_metadata": false
}
```

**Features**:
- Combines data analysis and visualization
- Supports various analysis focus areas
- Returns structured analysis results with visualizations

#### 2. `/integrated/custom-analysis` (POST)
**Purpose**: Custom analysis with user-defined parameters

**Request Model**: `CustomAnalysisRequest`
```json
{
  "location": "Seattle, WA",
  "custom_query": "zoning and development permits for mixed-use properties",
  "include_visualizations": true,
  "visualization_preferences": {
    "chart_type": "bar",
    "color_scheme": "professional"
  },
  "include_metadata": false
}
```

**Features**:
- Flexible custom analysis queries
- Optional visualization generation
- Custom visualization preferences
- Tailored to specific research needs

#### 3. `/integrated/batch-analysis` (POST)
**Purpose**: Process multiple locations simultaneously

**Request Model**: `BatchAnalysisRequest`
```json
{
  "locations": ["Austin, TX", "Denver, CO", "Portland, OR"],
  "analysis_focus": "crime and safety",
  "include_metadata": false
}
```

**Features**:
- Parallel processing of multiple locations
- Comprehensive batch summary
- Individual results for each location
- Success/failure tracking per location

### Quick Analysis Endpoints

#### 4. `/integrated/crime-analysis` (POST)
**Purpose**: Quick crime and safety analysis

**Parameters**: `location: str`

**Features**:
- Focused on crime data
- Automatic safety visualizations
- Quick turnaround for security assessments

#### 5. `/integrated/market-analysis` (POST)
**Purpose**: Demographics and market analysis

**Parameters**: `location: str`

**Features**:
- Market demographics focus
- Economic indicators
- Population and income analysis

### System Information Endpoints

#### 6. `/integrated/status` (GET)
**Purpose**: Get system health and component status

**Response Model**: `SystemStatusResponse`
```json
{
  "system_ready": true,
  "real_estate_agent_status": "ready",
  "visualization_agent_status": "ready",
  "mcp_server_connected": true,
  "available_analysis_types": [
    "comprehensive",
    "crime and safety",
    "demographics and economic indicators",
    "custom"
  ],
  "system_capabilities": {
    "real_estate_analysis": true,
    "data_visualization": true,
    "integrated_workflows": true,
    "batch_processing": true,
    "custom_analysis": true,
    "mcp_visualization_tools": true
  }
}
```

#### 7. `/integrated/analysis-types` (GET)
**Purpose**: Get available analysis types and descriptions

**Response Model**: `AnalysisTypesResponse`

**Features**:
- Predefined analysis types with descriptions
- Available focus areas
- Example queries for each type
- Custom analysis support information

#### 8. `/integrated/info` (GET)
**Purpose**: Detailed system capabilities

**Response Model**: `AgentInfoResponse`

**Features**:
- Comprehensive capability list
- Data source information
- Focus area descriptions
- System feature overview

## Request/Response Models

### New Request Models

1. **`BatchAnalysisRequest`**
   - `locations`: List of locations to analyze
   - `analysis_focus`: Focus area for analysis
   - `include_metadata`: Whether to include detailed metadata

2. **`CustomAnalysisRequest`**
   - `location`: Location to analyze
   - `custom_query`: Custom analysis query
   - `include_visualizations`: Whether to generate visualizations
   - `visualization_preferences`: Custom visualization settings
   - `include_metadata`: Whether to include metadata

3. **`IntegratedAnalysisRequest`** (Enhanced)
   - `location`: Location to analyze
   - `analysis_focus`: Focus area for analysis
   - `include_metadata`: Whether to include metadata

### New Response Models

1. **`BatchAnalysisResponse`**
   - `success`: Overall batch success status
   - `total_locations`: Number of locations processed
   - `successful_analyses`: Number of successful analyses
   - `failed_analyses`: Number of failed analyses
   - `results`: Individual analysis results
   - `summary`: Batch operation summary

2. **`SystemStatusResponse`**
   - `system_ready`: Whether the integrated system is ready
   - `real_estate_agent_status`: Real estate agent status
   - `visualization_agent_status`: Visualization agent status
   - `mcp_server_connected`: MCP server connection status
   - `available_analysis_types`: List of available analysis types
   - `system_capabilities`: Detailed capability information

3. **`AnalysisTypesResponse`**
   - `predefined_types`: List of predefined analysis types
   - `custom_supported`: Whether custom analysis is supported
   - `focus_areas`: Available focus areas
   - `examples`: Example queries for each type

## Usage Examples

### 1. Comprehensive Analysis
```bash
curl -X POST "http://localhost:8000/integrated/analyze" \
     -H "Content-Type: application/json" \
     -d '{
       "location": "Austin, TX",
       "analysis_focus": "comprehensive",
       "include_metadata": true
     }'
```

### 2. Custom Analysis
```bash
curl -X POST "http://localhost:8000/integrated/custom-analysis" \
     -H "Content-Type: application/json" \
     -d '{
       "location": "Seattle, WA",
       "custom_query": "environmental impact and flood risk assessment",
       "include_visualizations": true,
       "include_metadata": false
     }'
```

### 3. Batch Analysis
```bash
curl -X POST "http://localhost:8000/integrated/batch-analysis" \
     -H "Content-Type: application/json" \
     -d '{
       "locations": ["Austin, TX", "Denver, CO", "Portland, OR"],
       "analysis_focus": "crime and safety",
       "include_metadata": false
     }'
```

### 4. System Status Check
```bash
curl -X GET "http://localhost:8000/integrated/status"
```

## Analysis Focus Options

### Predefined Analysis Types
- **comprehensive**: Complete due diligence analysis covering all major factors
- **crime and safety**: Focus on crime statistics, safety data, and security factors
- **demographics and economic indicators**: Population demographics, income data, employment statistics
- **zoning and planning**: Zoning regulations, development permits, planning restrictions
- **environmental factors**: Environmental data, pollution levels, natural hazards
- **transportation and infrastructure**: Transportation access, infrastructure quality, connectivity
- **utilities and services**: Utility availability, service quality, municipal services

### Custom Analysis
The system supports custom analysis queries with natural language descriptions:
- "Flood risk assessment for waterfront properties"
- "Tech industry impact on local real estate values"
- "School district ratings and family demographics"
- "Commercial development potential and zoning restrictions"

## Error Handling

All endpoints include comprehensive error handling:
- Individual location failures in batch processing
- Component initialization failures
- Network connectivity issues with MCP server
- Invalid location or analysis parameters
- Processing timeouts and resource limitations

## Integration Features

The integrated endpoints provide:
1. **Seamless Workflow**: Automatic coordination between data analysis and visualization
2. **Flexible Parameters**: Support for custom analysis requirements
3. **Scalable Processing**: Batch operations for multiple locations
4. **Rich Metadata**: Optional detailed processing information
5. **Status Monitoring**: Real-time system health and capability tracking
6. **Comprehensive Examples**: Built-in examples and documentation

## API Documentation

All endpoints are fully documented in the FastAPI automatic documentation:
- **Swagger UI**: Available at `/docs`
- **ReDoc**: Available at `/redoc`
- **Examples**: Available at `/examples`

The integrated endpoints significantly enhance the API's capabilities by providing sophisticated analysis workflows that combine multiple AI agents for comprehensive real estate intelligence.
