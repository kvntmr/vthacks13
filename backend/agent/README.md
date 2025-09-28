# Commercial Real Estate Due Diligence Agent

This is a specialized LangChain agent powered by Google Gemini that helps commercial real estate professionals conduct due diligence by analyzing government datasets from Data.gov. The agent can search for and analyze data related to crime, zoning, construction permits, environmental factors, demographics, and other key indicators that impact real estate investment decisions.

## 🛠️ Available Tools

### Search Tools
- **`search_packages_simple`** - Basic dataset search with query and row limit
- **`search_packages_by_organization`** - Filter datasets by government agency
- **`search_packages_by_format`** - Filter datasets by file format (CSV, JSON, XML, etc.)
- **`get_recent_datasets`** - Find recently updated datasets
- **`get_organization_datasets`** - Get all datasets from a specific organization  
- **`get_datasets_by_tag`** - Search datasets by topic tags

### Analysis Tools
- **`get_package_details`** - Get complete dataset metadata
- **`get_package_resources`** - List all downloadable files in a dataset
- **`validate_and_get_resource_info`** - Check if data URLs are accessible
- **`download_small_dataset`** - Download and parse small datasets (max 10MB)

### Catalog Tools
- **`list_groups`** - List all government organizations in the catalog
- **`list_tags`** - List all available topic tags (warning: slow operation)
- **`get_catalog_info`** - Get overview of the Data.gov catalog
- **`build_search_query`** - Build complex CKAN search queries

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Google Gemini API Key

```bash
export GOOGLE_API_KEY="your-google-api-key-here"
```

Or get it from [Google AI Studio](https://makersuite.google.com/app/apikey).

### 3. Basic Real Estate Agent Usage

```python
from real_estate_agent import create_real_estate_agent

# Create the specialized real estate agent
agent = create_real_estate_agent()

# Ask real estate due diligence questions
result = agent.query_sync("Find crime data for downtown Seattle")
print(result['response'])

# Start interactive mode
agent.interactive_mode()
```

### 4. Quick Query Function

```python
from real_estate_agent import query_real_estate_data_sync

# One-off queries without creating an agent instance
result = query_real_estate_data_sync(
    "What zoning information is available for Austin, Texas?"
)
print(result['response'])
```

## 🏢 Real Estate Agent Features

The Commercial Real Estate Due Diligence Agent specializes in:

### 🛡️ **Crime & Safety Analysis**
- Crime statistics by location/zip code
- Police incident reports and patterns
- Public safety metrics and trends
- Emergency response data

### 🏗️ **Zoning & Planning Information**
- Zoning classifications and restrictions
- Land use regulations and changes
- Development permits and approvals
- Planning commission records

### 🚧 **Construction & Development Data**
- Building permits and activity trends
- Code violations and inspections
- Infrastructure development projects
- Construction cost indicators

### 🌍 **Environmental Factors**
- Water and air quality reports
- Soil contamination assessments
- Flood zone and climate data
- Environmental impact studies

### 📊 **Demographics & Economics**
- Population growth and demographics
- Income and employment statistics
- Business activity and licenses
- Tax assessment data

### 🚛 **Transportation & Infrastructure**
- Traffic patterns and accessibility
- Public transit connectivity
- Road conditions and projects
- Airport and shipping access

### 4. Using Individual Tools

```python
from tooling import search_packages_simple, get_package_details

# Search for datasets
results = search_packages_simple.invoke({
    "query": "climate change", 
    "rows": 5
})

# Get details about a specific dataset
if results["success"]:
    dataset_id = results["result"]["results"][0]["id"]
    details = get_package_details.invoke({"package_id": dataset_id})
    print(details["result"]["title"])
```

## 📊 Example Real Estate Queries

Here are some example questions the agent can help with:

### 🏙️ **Location Analysis**
- **"Find crime statistics for downtown Austin, Texas"**
- **"What's the air quality data for Los Angeles commercial districts?"**
- **"Get demographic data for the Seattle metro area"**

### 🏢 **Property Due Diligence**
- **"Search for zoning information in Portland, Oregon"**
- **"Find building permit activity in Miami over the last 2 years"**
- **"What environmental hazards should I know about in Houston?"**

### 📈 **Market Research**
- **"Show me construction trends in Denver, Colorado"**
- **"Find transportation infrastructure data for Chicago"**
- **"Get economic indicators for commercial real estate in Atlanta"**

### 🔍 **Specific Datasets**
- **"Download recent flood zone data for waterfront properties"**
- **"Find EPA superfund sites near my target area"**
- **"Get traffic count data for retail location analysis"**

## 🏗️ Tool Categories

### Search & Discovery
Use these tools to find relevant datasets:
```python
# Basic search
search_packages_simple.invoke({"query": "education", "rows": 10})

# Organization-specific search  
search_packages_by_organization.invoke({
    "query": "school performance", 
    "organization": "ed-gov",
    "rows": 5
})

# Format-specific search
search_packages_by_format.invoke({
    "query": "budget data",
    "format_type": "CSV", 
    "rows": 10
})
```

### Data Analysis
Use these tools to examine and download data:
```python
# Get dataset metadata
get_package_details.invoke({"package_id": "dataset-id-here"})

# List available files
get_package_resources.invoke({"package_id": "dataset-id-here"})

# Download small datasets
download_small_dataset.invoke({
    "resource_url": "https://example.gov/data.csv",
    "format_hint": "csv"
})
```

### Catalog Exploration
Use these tools to understand the Data.gov ecosystem:
```python
# Get catalog overview
get_catalog_info.invoke({})

# List all organizations
list_groups.invoke({"all_fields": True})

# Build complex queries
build_search_query.invoke({
    "keywords": "energy consumption",
    "organization": "eia-gov",
    "format": "CSV",
    "date_modified_start": "2023-01-01"
})
```

## 🎯 Best Practices

### Agent Workflow
1. **Start broad** - Use `get_catalog_info()` or `list_groups()` to understand scope
2. **Search strategically** - Use organization/format filters to narrow results
3. **Validate data** - Use `validate_and_get_resource_info()` before downloading
4. **Examine metadata** - Use `get_package_details()` to understand data structure
5. **Download selectively** - Use `download_small_dataset()` for analysis samples

### Error Handling
All tools return a consistent format:
```python
{
    "success": True/False,
    "result": {...},  # Tool-specific results
    "error": {...}    # Error details if success=False
}
```

### Performance Tips
- **Avoid `list_tags()`** for large catalogs (can take 2+ minutes)
- **Use specific searches** rather than broad wildcards
- **Limit result counts** to avoid overwhelming responses
- **Cache catalog info** for repeated use

## 🔧 Advanced Configuration

### Custom System Prompt
Use the provided `AGENT_SYSTEM_PROMPT` for a comprehensive agent persona:

```python
from tooling import AGENT_SYSTEM_PROMPT

prompt = ChatPromptTemplate.from_messages([
    ("system", AGENT_SYSTEM_PROMPT),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}")
])
```

### Tool Subsets
Create specialized agents with tool subsets:

```python
# Search-only agent
search_tools = [
    search_packages_simple,
    search_packages_by_organization,
    get_package_details
]

# Analysis-only agent  
analysis_tools = [
    get_package_resources,
    validate_and_get_resource_info,
    download_small_dataset
]
```

## 📝 Running the Agent

### Interactive Mode
Start a conversation with the agent:

```bash
python real_estate_agent.py
```

This starts an interactive session where you can ask real estate questions directly.

### Test the Agent
Verify everything works correctly:

```bash
python test_agent.py
```

This will:
- Test agent creation and tool loading
- Verify system prompt configuration
- Run example queries (if API key is configured)
- Provide a comprehensive test report

### Example Usage Demonstrations
See various usage patterns:

```bash
python example_usage.py
```

This includes:
- Quick single queries
- Comprehensive property analysis
- Batch analysis for multiple locations
- Interactive demonstration mode
- Data source exploration examples

## 🏛️ Data.gov API Reference

These tools interact with the CKAN API endpoints:
- **Search**: `https://catalog.data.gov/api/3/action/package_search`
- **Details**: `https://catalog.data.gov/api/3/action/package_show`
- **Organizations**: `https://catalog.data.gov/api/3/action/group_list`
- **Tags**: `https://catalog.data.gov/api/3/action/tag_list`

For more information, see the [CKAN API Documentation](https://docs.ckan.org/en/2.9/api/).

## 🤝 Contributing

To add new tools:
1. Create async functions in `tooling.py`
2. Add `@tool` decorator
3. Include in `DATA_GOV_TOOLS` list
4. Add synchronous wrapper if needed
5. Update documentation

## 📄 License

This module is designed for use with publicly available U.S. government data via the Data.gov API.
