# JSON Saving Enhancement for Data.gov Tooling

## Overview

The Data.gov tooling functions have been enhanced with optional JSON file saving capability. All main tooling functions now support saving their results to JSON files with proper serialization of complex data types including pandas DataFrames.

## Features Added

### 1. JSON Utility Functions

- **`_save_to_json(data, file_path)`**: Saves any data structure to a JSON file with proper serialization
- **`_prepare_for_json_serialization(obj)`**: Recursively handles complex data types for JSON compatibility

### 2. Enhanced Functions

All the following functions now accept an optional `json_file_path` parameter:

- `search_packages()` - Save search results
- `get_package_details()` - Save package metadata  
- `list_groups()` - Save organization data
- `list_tags()` - Save tag data
- `fetch_resource_data()` - Save actual dataset content
- `get_package_resources()` - Save resource information
- `validate_resource_url()` - Save URL validation results

## Usage Examples

### Basic Usage

```python
from tooling import search_packages_sync

# Search and save results to JSON
result = search_packages_sync(
    query="climate data",
    rows=10,
    json_file_path="search_results.json"
)

if result.get('json_saved'):
    print(f"Results saved to: {result['json_file_path']}")
    print(f"File size: {result['json_file_size']} bytes")
```

### Saving DataFrame Data

```python
from tooling import fetch_resource_data_sync

# Download CSV data and save with DataFrame serialization
result = fetch_resource_data_sync(
    resource_url="https://example.gov/data.csv",
    json_file_path="dataset.json"
)

# The pandas DataFrame will be saved with metadata:
# {
#   "success": true,
#   "data": {
#     "_type": "pandas_dataframe",
#     "_shape": [rows, cols],
#     "_columns": ["col1", "col2", ...],
#     "_data": [...],
#     "_dtypes": {...}
#   },
#   "_metadata": {
#     "saved_at": "2025-09-28T01:07:48.410767",
#     "data_source": "data.gov",
#     "saved_by": "tooling.py"
#   }
# }
```

## Data Type Support

The JSON serialization handles:

- **pandas DataFrame**: Saved with shape, columns, data, and dtypes information
- **pandas Series**: Saved with name, data, and dtype
- **datetime objects**: Converted to ISO format strings
- **nested dictionaries/lists**: Recursively processed
- **custom objects**: Objects with `__dict__` are serialized
- **standard types**: str, int, float, bool, None pass through unchanged

## File Structure

### Metadata Added to All JSON Files

Every saved JSON file includes metadata:

```json
{
  "success": true,
  "result": { ... },
  "_metadata": {
    "saved_at": "2025-09-28T01:07:48.410767",
    "data_source": "data.gov", 
    "saved_by": "tooling.py"
  },
  "json_saved": true,
  "json_file_path": "/absolute/path/to/file.json",
  "json_file_size": 12345,
  "json_saved_at": "2025-09-28T01:07:48.410767"
}
```

### Directory Creation

The system automatically creates directories if they don't exist when saving files.

## Error Handling

If JSON saving fails:

```json
{
  "success": true,
  "result": { ... },
  "json_saved": false,
  "json_error": "Error message",
  "json_file_path": "attempted/path.json"
}
```

## Testing

A comprehensive test suite is included:

- **`simple_json_test.py`**: Tests core JSON functionality with various data types
- **`test_json_saving.py`**: Full integration tests with actual API calls

### Running Tests

```bash
# Test core JSON functionality
python simple_json_test.py

# Full integration test (requires internet connection)
python test_json_saving.py
```

## Benefits

1. **Data Persistence**: Save API responses for offline analysis
2. **Caching**: Avoid repeated API calls by saving results
3. **Complex Data Support**: Proper handling of pandas DataFrames
4. **Metadata Tracking**: Know when and how data was saved
5. **Easy Integration**: Optional parameter - backward compatible

## File Locations

By default, JSON files are saved to the specified path. Use absolute paths or relative paths from the working directory.

Example directory structure:
```
your_project/
├── data_exports/
│   ├── search_results_20250928.json
│   ├── package_details_climate.json
│   └── resource_data_housing.json
```

## Real Estate Agent Integration

The enhanced tooling seamlessly works with the Real Estate Agent:

```python
from real_estate_agent import create_real_estate_agent

agent = create_real_estate_agent()

# The agent can now save data automatically
response = agent.query_sync(
    "Find crime data for Austin, Texas and save to crime_austin.json"
)
```

This enhancement makes the Data.gov tooling more powerful for research workflows where data persistence and offline analysis are important.
