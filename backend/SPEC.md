# Data.gov API Integration Specification

## Tech Stack

- **Python**: Core programming language
- **httpx**: Async HTTP client for API requests
- **pydantic**: Data validation and serialization
- **pandas**: Data manipulation and analysis (for resource data)
- **typing**: Type hints for better code documentation
- **json**: JSON parsing and handling
- **urllib.parse**: URL parsing and validation

## Functions and Descriptions

### Core API Functions

#### 1. `search_packages(query: str, rows: int = 10, start: int = 0, **filters) -> dict`
- **Purpose**: Search for datasets using the CKAN package_search endpoint
- **Parameters**:
  - `query`: Search terms
  - `rows`: Number of results to return (default: 10)
  - `start`: Starting index for pagination (default: 0)
  - `**filters`: Additional CKAN filters (e.g., organization, tags, format)
- **Returns**: Dictionary containing search results and metadata
- **Endpoint**: `GET /action/package_search`

#### 2. `get_package_details(package_id: str) -> dict`
- **Purpose**: Retrieve detailed information about a specific dataset
- **Parameters**:
  - `package_id`: Unique identifier or name of the package
- **Returns**: Complete package metadata including resources
- **Endpoint**: `GET /action/package_show`

#### 3. `list_groups() -> dict`
- **Purpose**: Retrieve all available groups/organizations
- **Parameters**: None
- **Returns**: List of all groups with basic metadata
- **Endpoint**: `GET /action/group_list`

#### 4. `list_tags() -> dict`
- **Purpose**: Retrieve all available tags in the catalog
- **Parameters**: None
- **Returns**: List of all tags used across datasets
- **Endpoint**: `GET /action/tag_list`

### Resource Data Functions

#### 5. `fetch_resource_data(resource_url: str, format_hint: str = None) -> dict`
- **Purpose**: Download and parse data from a dataset resource URL
- **Parameters**:
  - `resource_url`: Direct URL to the data resource
  - `format_hint`: Optional format specification (csv, json, xml, etc.)
- **Returns**: Parsed data in appropriate format (DataFrame for CSV, dict for JSON)
- **Notes**: Handles various data formats automatically

#### 6. `get_package_resources(package_id: str) -> list`
- **Purpose**: Extract all resource URLs and metadata from a package
- **Parameters**:
  - `package_id`: Package identifier
- **Returns**: List of resource dictionaries with URLs, formats, and descriptions

### Utility Functions

#### 7. `validate_resource_url(url: str) -> bool`
- **Purpose**: Validate if a resource URL is accessible and downloadable
- **Parameters**:
  - `url`: Resource URL to validate
- **Returns**: Boolean indicating URL accessibility

#### 8. `build_search_query(**criteria) -> str`
- **Purpose**: Helper function to build complex CKAN search queries
- **Parameters**:
  - `**criteria`: Various search criteria (keywords, organization, format, etc.)
- **Returns**: Formatted CKAN query string

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           AI Agent                             │
│                     (Consumer System)                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Function Calls
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Python Data.gov API Client                     │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Search Fns    │  │  Package Fns    │  │  Resource Fns   │ │
│  │                 │  │                 │  │                 │ │
│  │ search_packages │  │get_package_details│  │fetch_resource   │ │
│  │ list_groups     │  │get_package_resources│ │   _data       │ │
│  │ list_tags       │  │                 │  │validate_resource│ │
│  │                 │  │                 │  │    _url         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    HTTP Client (httpx)                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ HTTP Requests
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data.gov CKAN API                           │
│                  https://catalog.data.gov/api/3                │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   /action/      │  │   /action/      │  │   /action/      │ │
│  │package_search   │  │ package_show    │  │  group_list     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   /action/      │                                           │
│  │   tag_list      │                                           │
│  └─────────────────┘                                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Resource URLs
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Agency Data Servers                      │
│         (CSV, JSON, XML files hosted by agencies)              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Agency A      │  │   Agency B      │  │   Agency C      │ │
│  │   CSV Files     │  │   JSON APIs     │  │   XML Data      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. AI Agent calls search/discovery functions
2. Functions query CKAN API for metadata
3. AI Agent identifies relevant datasets
4. Functions fetch actual data from agency servers
5. Parsed data returned to AI Agent for analysis
```

## Additional Notes

### Error Handling Strategy
- **No Retry Logic**: Functions return raw error responses for AI Agent to handle
- **HTTP Errors**: Return structured error dictionaries with status codes and messages
- **Data Parsing Errors**: Return error details when resource data cannot be parsed
- **URL Validation**: Functions validate URLs before attempting downloads

### Data Format Support
- **JSON**: Primary format for API responses
- **CSV**: Automatic parsing to pandas DataFrames
- **XML**: Basic parsing support
- **Excel**: Support for .xlsx files
- **Plain Text**: Raw text return for unsupported formats

### AI Agent Integration Considerations
- **Structured Returns**: All functions return consistent dictionary structures
- **Metadata Rich**: Include resource format, size, and description in responses
- **Type Hints**: Complete type annotations for AI Agent understanding
- **Documentation**: Comprehensive docstrings with parameter descriptions

### Performance Considerations
- **Async Support**: httpx enables concurrent requests when needed
- **Streaming**: Large resource downloads use streaming for memory efficiency
- **Caching**: Optional caching layer for frequently accessed metadata

### Security Considerations
- **URL Validation**: Prevent access to internal/malicious URLs
- **Size Limits**: Configurable limits on resource download sizes
- **Content-Type Validation**: Verify expected data formats before processing

### Dataset Discovery Workflow
1. Use `search_packages()` to find relevant datasets
2. Use `get_package_details()` to examine specific datasets
3. Use `get_package_resources()` to identify downloadable data
4. Use `fetch_resource_data()` to retrieve actual data for analysis
5. AI Agent performs visualization and analytics on retrieved data

### Configuration Options
- Base URL configurable for different CKAN instances
- Timeout settings for HTTP requests
- Maximum file size limits for resource downloads
- Custom headers for agency-specific requirements
