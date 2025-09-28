# LangGraph Visualization Agent

## Overview

This project implements a specialized **LangGraph Visualization Agent** that connects to an MCP (Model Context Protocol) server to provide powerful data visualization capabilities. The agent integrates seamlessly with the existing real estate analysis system to create comprehensive visual insights.

## 🏗️ Architecture

### Core Components

1. **VisualizationAgent** (`visualization_agent.py`)
   - LangGraph-powered agent specialized for data visualization
   - Connects to MCP server via `langchain_mcp_adapters`
   - Uses streamable HTTP transport for real-time communication

2. **IntegratedRealEstateAnalysis** (`integrated_agents_example.py`)
   - Combines real estate data analysis with visualization
   - Orchestrates both agents for comprehensive insights
   - Provides specialized analysis workflows

3. **Enhanced API** (`api.py`)
   - RESTful endpoints for visualization and integrated analysis
   - FastAPI-based with comprehensive error handling
   - Swagger documentation auto-generated

4. **Test Suite** (`test_visualization_agent.py`)
   - Comprehensive testing for all components
   - MCP connection validation
   - Integration testing

## 🚀 Features

### Visualization Capabilities
- **Chart Types**: Bar charts, line graphs, scatter plots, pie charts
- **Advanced Visualizations**: Heatmaps, geographic maps, time series
- **Interactive Elements**: Tooltips, zooming, filtering, brushing
- **Dashboard Layouts**: Multi-panel displays and comparative views
- **Export Formats**: PNG, SVG, PDF, HTML/JavaScript

### Data Analysis Integration
- **Real Estate Focus**: Crime, demographics, zoning, permits
- **Multi-source Data**: Data.gov integration with CSV/JSON processing
- **Contextual Visualization**: Data-driven chart recommendations
- **Automated Workflows**: Analysis → Visualization pipeline

### MCP Integration
- **Streamable HTTP**: Real-time connection to localhost:1122/mcp
- **Tool Discovery**: Dynamic loading of visualization tools
- **Error Handling**: Graceful fallback when MCP unavailable
- **Health Monitoring**: Connection status and tool availability

## 📋 Prerequisites

### Required Dependencies
```bash
pip install langchain-mcp-adapters langgraph "langchain[openai]"
pip install fastapi uvicorn pandas openpyxl httpx
```

### MCP Visualization Server
- Must be running at `http://localhost:1122/mcp`
- Should provide visualization tools via streamable HTTP transport
- Ensure server is accessible before starting the agent

### Environment Setup
```bash
export GOOGLE_API_KEY="your_google_api_key_here"
```

## 🏃‍♂️ Quick Start

### 1. Start the MCP Visualization Server
```bash
# Ensure your MCP visualization server is running on port 1122
# Example command (adjust based on your MCP server setup):
# your-mcp-server --port 1122 --transport streamable-http
```

### 2. Test the Visualization Agent
```bash
# Run comprehensive tests
python test_visualization_agent.py

# Or run interactive tests
python test_visualization_agent.py interactive
```

### 3. Start the API Server
```bash
python api.py
# API will be available at http://localhost:8000
# Documentation at http://localhost:8000/docs
```

### 4. Use the Agents Directly
```python
from visualization_agent import create_visualization_agent
from integrated_agents_example import IntegratedRealEstateAnalysis

# Create visualization agent
viz_agent = create_visualization_agent()

# Test basic functionality
result = await viz_agent.query("Create a bar chart showing sales data")

# Use integrated system
system = IntegratedRealEstateAnalysis()
analysis = await system.analyze_and_visualize("Austin, TX", "comprehensive")
```

## 🔧 API Endpoints

### Visualization Endpoints

#### `POST /visualization/query`
Create visualizations using the MCP visualization tools.

```json
{
  "request": "Create a scatter plot showing the relationship between crime rate and property values",
  "data_context": "Real estate data for Austin, TX...",
  "include_metadata": false
}
```

#### `GET /visualization/tools`
Get available visualization tools from the MCP server.

#### `GET /visualization/info`
Get information about the visualization agent's capabilities.

### Integrated Analysis Endpoints

#### `POST /integrated/analyze`
Perform comprehensive analysis with automatic visualizations.

```json
{
  "location": "Seattle, WA",
  "analysis_focus": "comprehensive",
  "include_metadata": false
}
```

#### `POST /integrated/crime-analysis`
Quick crime-focused analysis with visualizations.

#### `POST /integrated/market-analysis`
Demographics and market analysis with visualizations.

## 💡 Usage Examples

### Example 1: Basic Visualization
```python
import asyncio
from visualization_agent import create_visualization_agent

async def create_chart():
    agent = create_visualization_agent()
    
    request = """
    Create a line chart showing real estate price trends over the last 5 years:
    2019: $320,000
    2020: $335,000
    2021: $385,000
    2022: $425,000
    2023: $465,000
    2024: $485,000
    """
    
    result = await agent.query(request)
    print(result["response"])

asyncio.run(create_chart())
```

### Example 2: Integrated Analysis
```python
import asyncio
from integrated_agents_example import IntegratedRealEstateAnalysis

async def analyze_market():
    system = IntegratedRealEstateAnalysis()
    
    # Comprehensive analysis with visualizations
    result = await system.analyze_and_visualize(
        location="Portland, OR",
        analysis_focus="crime and safety"
    )
    
    if result["success"]:
        print(f"Analysis complete for {result['location']}")
        print(f"Data analysis: {result['data_analysis']['success']}")
        print(f"Visualizations: {result['visualizations']['success']}")
    else:
        print(f"Errors: {result['errors']}")

asyncio.run(analyze_market())
```

### Example 3: API Usage
```bash
# Test visualization endpoint
curl -X POST "http://localhost:8000/visualization/query" \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Create a dashboard showing key real estate metrics",
    "data_context": "Austin market data with crime, demographics, prices"
  }'

# Test integrated analysis
curl -X POST "http://localhost:8000/integrated/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Miami, FL",
    "analysis_focus": "comprehensive"
  }'
```

## 🔄 Workflow Integration

### Standard Workflow
1. **Data Collection**: Real estate agent gathers data from Data.gov
2. **Data Analysis**: Agent analyzes trends, patterns, and insights
3. **Visualization**: Visualization agent creates appropriate charts
4. **Integration**: Combined output provides comprehensive insights

### Specialized Workflows
- **Crime Analysis**: Focus on safety data with geographic visualizations
- **Market Analysis**: Demographics and economics with comparative charts
- **Permit Analysis**: Construction trends with time series visualizations
- **Environmental Analysis**: Risk factors with heatmaps and overlays

## 🛠️ Configuration

### MCP Server Configuration
```python
# Custom MCP server URL
agent = create_visualization_agent(
    mcp_server_url="http://your-server:8080/mcp"
)

# Different API key
agent = create_visualization_agent(
    google_api_key="your_custom_key"
)
```

### Integrated System Configuration
```python
# Custom configuration for both agents
system = IntegratedRealEstateAnalysis(
    google_api_key="your_key",
    mcp_server_url="http://custom-server:1122/mcp"
)
```

## 🚨 Troubleshooting

### Common Issues

#### MCP Server Not Connected
```
Error: MCP visualization server not connected
```
**Solution**: 
- Ensure MCP server is running on localhost:1122
- Check firewall settings
- Verify server supports streamable HTTP transport

#### No Visualization Tools Available
```
Warning: No tools received from MCP server
```
**Solution**:
- Restart the MCP server
- Check server logs for errors
- Verify tool registration in MCP server

#### API Key Issues
```
Error: Google API key not found
```
**Solution**:
- Set environment variable: `export GOOGLE_API_KEY="your_key"`
- Or provide key directly when creating agents

### Debug Mode
```python
# Enable detailed logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Test MCP connection
agent = create_visualization_agent()
tools = await agent.get_available_tools()
print(f"Available tools: {tools}")
```

## 📊 Performance Considerations

### Optimization Tips
- **Tool Loading**: Tools are loaded once at startup
- **Connection Pooling**: MCP client maintains persistent connections
- **Error Handling**: Graceful degradation when MCP unavailable
- **Async Operations**: All I/O operations are asynchronous

### Resource Usage
- **Memory**: ~50-100MB per agent instance
- **Network**: Persistent HTTP connection to MCP server
- **Processing**: Depends on visualization complexity and data size

## 🧪 Testing

### Test Categories
1. **Unit Tests**: Individual component functionality
2. **Integration Tests**: MCP server communication
3. **End-to-End Tests**: Complete workflow validation
4. **Performance Tests**: Load and stress testing

### Running Tests
```bash
# Full test suite
python test_visualization_agent.py

# Interactive testing
python test_visualization_agent.py interactive

# Specific test functions
python -c "
import asyncio
from test_visualization_agent import test_mcp_connection
asyncio.run(test_mcp_connection())
"
```

## 📚 Advanced Usage

### Custom Visualization Prompts
```python
# Highly specific visualization request
custom_prompt = """
Create a multi-panel dashboard for real estate investment analysis:

Panel 1: Time series showing price trends (line chart)
Panel 2: Crime rate comparison by neighborhood (bar chart)  
Panel 3: Population density heatmap
Panel 4: School ratings vs property values (scatter plot)

Use consistent color scheme and professional styling.
Include interactive tooltips and zoom capabilities.
Export as HTML for web integration.
"""

result = await agent.query(custom_prompt, data_context)
```

### Batch Processing
```python
# Analyze multiple locations
locations = ["Austin, TX", "Seattle, WA", "Denver, CO"]
results = []

for location in locations:
    result = await system.quick_crime_analysis(location)
    results.append(result)

# Compare results across locations
comparison_data = {
    "locations": [r["location"] for r in results],
    "success_rates": [r["success"] for r in results]
}
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Install development dependencies
3. Run the test suite
4. Make your changes
5. Submit a pull request

### Code Style
- Follow PEP 8 guidelines
- Use type hints for all functions
- Include comprehensive docstrings
- Add tests for new functionality

## 📄 License

This project is part of the VTHacks 13 backend agent system. See the main project repository for license information.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Run the test suite for diagnostics
3. Review MCP server logs
4. Check the API documentation at `/docs`

Remember to ensure your MCP visualization server is properly configured and running before using the visualization agent!
