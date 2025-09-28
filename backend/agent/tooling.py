"""
Data.gov API Integration Module with LangChain Tools

This module provides functions to interact with the Data.gov CKAN API
for searching, retrieving, and processing government datasets.
All functions are decorated as LangChain tools for use with agents.
"""

import json
import urllib.parse
import xml.etree.ElementTree as ET
import io
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Union
import httpx
import pandas as pd
from pydantic import BaseModel, ValidationError

# LangChain imports for tool creation
from langchain_core.tools import tool, StructuredTool


# Base configuration
BASE_URL = "https://catalog.data.gov/api/3"
DEFAULT_TIMEOUT = 30.0
TAGS_TIMEOUT = 120.0  # Tags endpoint can be very slow due to large number of tags
RESOURCE_TIMEOUT = 300.0  # Timeout for resource data downloads (5 minutes)
MAX_RESOURCE_SIZE = 100 * 1024 * 1024  # 100MB limit for resource downloads
STREAMING_THRESHOLD = 10 * 1024 * 1024  # 10MB threshold for streaming downloads

# AI Files configuration
AI_FILES_DIR = "./AI_FILES/"
_file_counter = {"value": 0}  # Use dict to make it mutable for global access


def save_to_file(data: Dict[str, Any], filename: str = None, function_name: str = "unknown") -> Dict[str, Any]:
    """
    Save data to a file in the AI_FILES directory.
    
    This function automatically saves the data returned by tooling functions to files
    for later access by AI models. It handles automatic filename generation when
    no filename is provided.
    
    Args:
        data (Dict[str, Any]): Data to save
        filename (str, optional): Specific filename to use. If not provided, generates a default name.
        function_name (str): Name of the calling function for default filename generation
        
    Returns:
        Dict[str, Any]: Updated data dictionary with save information added
    """
    # Generate default filename if not provided
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        _file_counter["value"] += 1
        filename = f"{function_name}_{timestamp}_{_file_counter['value']:04d}.json"
    
    # Ensure filename has .json extension
    if not filename.lower().endswith('.json'):
        filename += '.json'
    
    # Create full file path in AI_FILES directory
    file_path = Path(AI_FILES_DIR) / filename
    
    # Use existing _save_to_json function to handle the actual saving
    save_result = _save_to_json(data, str(file_path))
    
    # Add save information to the data
    data_copy = data.copy()
    data_copy.update(save_result)
    
    return data_copy


class APIError(Exception):
    """Custom exception for API-related errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(self.message)


def _save_to_json(data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
    """
    Save data to a JSON file with proper serialization handling.
    
    This utility function handles saving complex data structures to JSON files,
    including pandas DataFrames and other non-serializable objects.
    
    Args:
        data: Dictionary containing the data to save
        file_path: Path where to save the JSON file
        
    Returns:
        Dict with save operation results including file path, size, and success status
        
    Raises:
        Exception: When JSON serialization or file writing fails
    """
    try:
        # Create directory if it doesn't exist
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create a copy of the data for JSON serialization
        json_data = _prepare_for_json_serialization(data.copy())
        
        # Add metadata about when this was saved
        json_data["_metadata"] = {
            "saved_at": datetime.now().isoformat(),
            "data_source": "data.gov",
            "saved_by": "tooling.py"
        }
        
        # Write to JSON file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        
        # Get file size
        file_size = file_path.stat().st_size
        
        return {
            "json_saved": True,
            "json_file_path": str(file_path.absolute()),
            "json_file_size": file_size,
            "json_saved_at": json_data["_metadata"]["saved_at"]
        }
        
    except Exception as e:
        return {
            "json_saved": False,
            "json_error": str(e),
            "json_file_path": str(file_path) if 'file_path' in locals() else None
        }


def _prepare_for_json_serialization(obj: Any) -> Any:
    """
    Recursively prepare an object for JSON serialization.
    
    This function handles various data types that are not natively JSON serializable,
    including pandas DataFrames, numpy arrays, and datetime objects.
    
    Args:
        obj: Object to prepare for JSON serialization
        
    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, pd.DataFrame):
        # Convert DataFrame to dict format with metadata
        return {
            "_type": "pandas_dataframe",
            "_shape": obj.shape,
            "_columns": list(obj.columns),
            "_data": obj.to_dict(orient='records'),
            "_dtypes": {col: str(dtype) for col, dtype in obj.dtypes.items()}
        }
    elif isinstance(obj, pd.Series):
        # Convert Series to dict format
        return {
            "_type": "pandas_series",
            "_name": obj.name,
            "_data": obj.to_dict(),
            "_dtype": str(obj.dtype)
        }
    elif isinstance(obj, dict):
        # Recursively process dictionary values
        return {key: _prepare_for_json_serialization(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        # Recursively process list/tuple items
        return [_prepare_for_json_serialization(item) for item in obj]
    elif isinstance(obj, datetime):
        # Convert datetime to ISO format string
        return {
            "_type": "datetime",
            "_value": obj.isoformat()
        }
    elif hasattr(obj, '__dict__') and not isinstance(obj, (str, int, float, bool)):
        # Handle objects with __dict__ attribute (custom objects)
        return {
            "_type": "custom_object",
            "_class": obj.__class__.__name__,
            "_data": _prepare_for_json_serialization(obj.__dict__)
        }
    else:
        # Return as-is for JSON-serializable types (str, int, float, bool, None)
        return obj


async def search_packages_async(
    query: str, 
    rows: int = 10, 
    start: int = 0, 
    json_file_path: Optional[str] = None,
    **filters
) -> Dict[str, Any]:
    """
    Search for datasets using the CKAN package_search endpoint.
    
    This function searches the Data.gov catalog for datasets matching the provided
    query and filters. It returns structured results including metadata about
    the search and the matching packages.
    
    Args:
        query (str): Search terms to look for in dataset titles, descriptions, and content
        rows (int, optional): Number of results to return. Defaults to 10.
        start (int, optional): Starting index for pagination. Defaults to 0.
        json_file_path (str, optional): Path to save the results as a JSON file. If provided,
                                      the complete response will be saved to this file with 
                                      proper serialization of complex data types.
        **filters: Additional CKAN search parameters such as:
            - fq (str): Filter query using Solr syntax (e.g., 'organization:epa-gov')
            - facet (str): Enable/disable faceted search
            - facet_field (list): Fields to facet on
            - sort (str): Sort order (e.g., 'score desc', 'metadata_modified desc')
            - include_private (bool): Include private datasets (requires auth)
            - include_drafts (bool): Include draft datasets
            - use_default_schema (bool): Use default schema for response
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - result (dict): Search results containing:
                - count (int): Total number of matching datasets
                - results (list): List of dataset packages
                - search_facets (dict): Faceted search information
                - sort (str): Sort order used
                - facets (dict): Available facets for filtering
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the API request fails or returns an error
        
    Example:
        >>> results = await search_packages("climate data", rows=5, fq="organization:noaa-gov")
        >>> print(f"Found {results['result']['count']} datasets")
        >>> for dataset in results['result']['results']:
        ...     print(f"- {dataset['title']}")
    """
    
    # Build the query parameters
    params = {
        'q': query,
        'rows': rows,
        'start': start
    }
    
    # Add any additional filters
    for key, value in filters.items():
        if value is not None:
            params[key] = value
    
    # Construct the full URL
    endpoint = f"{BASE_URL}/action/package_search"
    
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(endpoint, params=params)
            
            # Parse the JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": {
                        "type": "json_decode_error",
                        "message": f"Failed to parse JSON response: {str(e)}",
                        "status_code": response.status_code,
                        "raw_content": response.text[:500]  # First 500 chars for debugging
                    }
                }
            
            # Check if the response indicates success
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": {
                        "type": "http_error",
                        "message": f"HTTP {response.status_code}: {response.reason_phrase}",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Check if CKAN API indicates success
            if not data.get("success", False):
                return {
                    "success": False,
                    "error": {
                        "type": "ckan_api_error",
                        "message": "CKAN API returned success=false",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Prepare successful response
            response_data = {
                "success": True,
                "result": data.get("result", {}),
                "help": data.get("help", ""),
                "query_params": params,
                "endpoint": endpoint
            }
            
            # Save to JSON file if requested (backward compatibility)
            if json_file_path:
                json_result = _save_to_json(response_data, json_file_path)
                response_data.update(json_result)
            
            # Always save to AI_FILES directory
            response_data = save_to_file(response_data, function_name="search_packages")
            
            return response_data
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {DEFAULT_TIMEOUT} seconds",
                "endpoint": endpoint,
                "params": params
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}",
                "endpoint": endpoint,
                "params": params
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}",
                "endpoint": endpoint,
                "params": params
            }
        }


async def get_package_details_async(package_id: str, json_file_path: Optional[str] = None, **options) -> Dict[str, Any]:
    """
    Retrieve detailed information about a specific dataset.
    
    This function fetches complete metadata for a specific dataset package,
    including all resources, organization information, tags, and other 
    detailed attributes.
    
    Args:
        package_id (str): Unique identifier or name of the package to retrieve.
                         Can be either the package's UUID or its URL-friendly name.
        json_file_path (str, optional): Path to save the package details as a JSON file.
                                      If provided, the complete response will be saved.
        **options: Additional CKAN package_show parameters such as:
            - include_tracking (bool): Include view tracking information
            - use_default_schema (bool): Use default schema for response
            - context (dict): Additional context parameters
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - result (dict): Complete package metadata containing:
                - id (str): Package UUID
                - name (str): Package URL-friendly name
                - title (str): Human-readable package title
                - notes (str): Package description
                - author (str): Package author
                - author_email (str): Author's email
                - organization (dict): Organization details
                - resources (list): List of downloadable resources
                - tags (list): List of associated tags
                - groups (list): List of associated groups
                - extras (list): Additional metadata fields
                - metadata_created (str): Creation timestamp
                - metadata_modified (str): Last modification timestamp
                - license_id (str): License identifier
                - license_title (str): License title
                - state (str): Package state (active, deleted, etc.)
                - type (str): Package type
                - url (str): Package homepage URL
                - version (str): Package version
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the API request fails or returns an error
        
    Example:
        >>> details = await get_package_details("electric-vehicle-population-data")
        >>> print(f"Title: {details['result']['title']}")
        >>> print(f"Resources: {len(details['result']['resources'])}")
        >>> for resource in details['result']['resources']:
        ...     print(f"- {resource['name']} ({resource['format']})")
    """
    
    # Validate package_id parameter
    if not package_id or not isinstance(package_id, str):
        return {
            "success": False,
            "error": {
                "type": "validation_error",
                "message": "package_id must be a non-empty string",
                "package_id": package_id
            }
        }
    
    # Build the query parameters
    params = {
        'id': package_id.strip()
    }
    
    # Add any additional options
    for key, value in options.items():
        if value is not None:
            params[key] = value
    
    # Construct the full URL
    endpoint = f"{BASE_URL}/action/package_show"
    
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(endpoint, params=params)
            
            # Parse the JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": {
                        "type": "json_decode_error",
                        "message": f"Failed to parse JSON response: {str(e)}",
                        "status_code": response.status_code,
                        "raw_content": response.text[:500]  # First 500 chars for debugging
                    }
                }
            
            # Check if the response indicates success
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": {
                        "type": "http_error",
                        "message": f"HTTP {response.status_code}: {response.reason_phrase}",
                        "status_code": response.status_code,
                        "response_data": data,
                        "package_id": package_id
                    }
                }
            
            # Check if CKAN API indicates success
            if not data.get("success", False):
                error_info = data.get("error", {})
                error_message = "CKAN API returned success=false"
                
                # Provide more specific error messages for common cases
                if "Not found" in str(error_info) or response.status_code == 404:
                    error_message = f"Package '{package_id}' not found"
                elif "Authorization" in str(error_info):
                    error_message = f"Access denied for package '{package_id}'"
                
                return {
                    "success": False,
                    "error": {
                        "type": "ckan_api_error",
                        "message": error_message,
                        "status_code": response.status_code,
                        "response_data": data,
                        "package_id": package_id
                    }
                }
            
            # Return successful response
            result = data.get("result", {})
            
            # Add some computed fields for convenience
            response_data = {
                "success": True,
                "result": result,
                "help": data.get("help", ""),
                "package_id": package_id,
                "endpoint": endpoint
            }
            
            # Add summary information for easier access
            if result:
                response_data["summary"] = {
                    "title": result.get("title", ""),
                    "resource_count": len(result.get("resources", [])),
                    "organization": result.get("organization", {}).get("title", ""),
                    "last_modified": result.get("metadata_modified", ""),
                    "tags": [tag.get("name", "") for tag in result.get("tags", [])],
                    "formats": list(set(res.get("format", "").upper() for res in result.get("resources", []) if res.get("format")))
                }
            
            # Save to JSON file if requested (backward compatibility)
            if json_file_path:
                json_result = _save_to_json(response_data, json_file_path)
                response_data.update(json_result)
            
            # Always save to AI_FILES directory
            response_data = save_to_file(response_data, function_name="get_package_details")
            
            return response_data
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {DEFAULT_TIMEOUT} seconds",
                "endpoint": endpoint,
                "package_id": package_id
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}",
                "endpoint": endpoint,
                "package_id": package_id
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}",
                "endpoint": endpoint,
                "package_id": package_id
            }
        }


async def list_groups_async(json_file_path: Optional[str] = None, **options) -> Dict[str, Any]:
    """
    Retrieve all available groups/organizations in the Data.gov catalog.
    
    This function fetches a list of all groups (organizations) available
    in the CKAN catalog, which can be used for filtering searches or
    discovering what organizations publish data.
    
    Args:
        json_file_path (str, optional): Path to save the groups list as a JSON file.
                                      If provided, the complete response will be saved.
        **options: Additional CKAN group_list parameters such as:
            - sort (str): Sort order for groups (e.g., 'name', 'packages')
            - all_fields (bool): Return full group objects instead of just names
            - include_extras (bool): Include extra fields for groups
            - include_users (bool): Include user information for groups
            - include_groups (bool): Include parent group information
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - result (list): List of groups, format depends on all_fields parameter:
                - If all_fields=False (default): List of group name strings
                - If all_fields=True: List of group dictionaries with full metadata:
                    - id (str): Group UUID
                    - name (str): Group URL-friendly name
                    - title (str): Human-readable group title  
                    - description (str): Group description
                    - display_name (str): Display name for the group
                    - image_display_url (str): Group logo/image URL
                    - package_count (int): Number of packages in the group
                    - created (str): Creation timestamp
                    - state (str): Group state (active, deleted, etc.)
            - count (int): Total number of groups
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the API request fails or returns an error
        
    Example:
        >>> # Get simple list of group names
        >>> groups = await list_groups()
        >>> print(f"Found {groups['count']} organizations")
        >>> for group in groups['result'][:5]:
        ...     print(f"- {group}")
        
        >>> # Get full group details
        >>> groups_detailed = await list_groups(all_fields=True)
        >>> for group in groups_detailed['result'][:3]:
        ...     print(f"- {group['title']} ({group['package_count']} datasets)")
    """
    
    # Build the query parameters
    params = {}
    
    # Add any additional options
    for key, value in options.items():
        if value is not None:
            params[key] = value
    
    # Construct the full URL
    endpoint = f"{BASE_URL}/action/group_list"
    
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(endpoint, params=params)
            
            # Parse the JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": {
                        "type": "json_decode_error",
                        "message": f"Failed to parse JSON response: {str(e)}",
                        "status_code": response.status_code,
                        "raw_content": response.text[:500]  # First 500 chars for debugging
                    }
                }
            
            # Check if the response indicates success
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": {
                        "type": "http_error",
                        "message": f"HTTP {response.status_code}: {response.reason_phrase}",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Check if CKAN API indicates success
            if not data.get("success", False):
                return {
                    "success": False,
                    "error": {
                        "type": "ckan_api_error",
                        "message": "CKAN API returned success=false",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Prepare successful response
            result = data.get("result", [])
            
            response_data = {
                "success": True,
                "result": result,
                "count": len(result),
                "help": data.get("help", ""),
                "endpoint": endpoint,
                "params": params
            }
            
            # Save to JSON file if requested (backward compatibility)
            if json_file_path:
                json_result = _save_to_json(response_data, json_file_path)
                response_data.update(json_result)
            
            # Always save to AI_FILES directory
            response_data = save_to_file(response_data, function_name="list_groups")
            
            return response_data
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {DEFAULT_TIMEOUT} seconds",
                "endpoint": endpoint
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}",
                "endpoint": endpoint
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}",
                "endpoint": endpoint
            }
        }


async def list_tags_async(json_file_path: Optional[str] = None, **options) -> Dict[str, Any]:
    """
    Retrieve all available tags used across datasets in the Data.gov catalog.
    
    This function fetches a comprehensive list of all tags that have been
    applied to datasets, which can be used for discovering topics, filtering
    searches, or understanding the catalog's content taxonomy.
    
    Note: This endpoint can be very slow (up to 2 minutes) due to the large 
    number of tags in the Data.gov catalog (potentially hundreds of thousands).
    
    Args:
        json_file_path (str, optional): Path to save the tags list as a JSON file.
                                      If provided, the complete response will be saved.
        **options: Additional CKAN tag_list parameters such as:
            - vocabulary_id (str): Filter tags by vocabulary ID
            - all_fields (bool): Return full tag objects instead of just names
            - include_extras (bool): Include extra fields for tags
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - result (list): List of tags, format depends on all_fields parameter:
                - If all_fields=False (default): List of tag name strings
                - If all_fields=True: List of tag dictionaries with metadata:
                    - id (str): Tag UUID
                    - name (str): Tag name/value
                    - display_name (str): Display name for the tag
                    - state (str): Tag state (active, deleted, etc.)
                    - vocabulary_id (str): Vocabulary this tag belongs to
            - count (int): Total number of tags
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the API request fails or returns an error
        
    Example:
        >>> # Get simple list of tag names
        >>> tags = await list_tags()
        >>> print(f"Found {tags['count']} tags")
        >>> print(f"Popular tags: {', '.join(tags['result'][:10])}")
        
        >>> # Get full tag details
        >>> tags_detailed = await list_tags(all_fields=True)
        >>> for tag in tags_detailed['result'][:5]:
        ...     print(f"- {tag['name']} (ID: {tag['id']})")
    """
    
    # Build the query parameters
    params = {}
    
    # Add any additional options
    for key, value in options.items():
        if value is not None:
            params[key] = value
    
    # Construct the full URL
    endpoint = f"{BASE_URL}/action/tag_list"
    
    try:
        async with httpx.AsyncClient(timeout=TAGS_TIMEOUT) as client:
            response = await client.get(endpoint, params=params)
            
            # Parse the JSON response
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": {
                        "type": "json_decode_error",
                        "message": f"Failed to parse JSON response: {str(e)}",
                        "status_code": response.status_code,
                        "raw_content": response.text[:500]  # First 500 chars for debugging
                    }
                }
            
            # Check if the response indicates success
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": {
                        "type": "http_error",
                        "message": f"HTTP {response.status_code}: {response.reason_phrase}",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Check if CKAN API indicates success
            if not data.get("success", False):
                return {
                    "success": False,
                    "error": {
                        "type": "ckan_api_error",
                        "message": "CKAN API returned success=false",
                        "status_code": response.status_code,
                        "response_data": data
                    }
                }
            
            # Prepare successful response
            result = data.get("result", [])
            
            response_data = {
                "success": True,
                "result": result,
                "count": len(result),
                "help": data.get("help", ""),
                "endpoint": endpoint,
                "params": params
            }
            
            # Save to JSON file if requested (backward compatibility)
            if json_file_path:
                json_result = _save_to_json(response_data, json_file_path)
                response_data.update(json_result)
            
            # Always save to AI_FILES directory
            response_data = save_to_file(response_data, function_name="list_tags")
            
            return response_data
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {TAGS_TIMEOUT} seconds (tags endpoint can be very slow)",
                "endpoint": endpoint
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}",
                "endpoint": endpoint
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}",
                "endpoint": endpoint
            }
        }


async def fetch_resource_data_async(
    resource_url: str, 
    format_hint: Optional[str] = None,
    max_size: Optional[int] = None,
    json_file_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Download and parse data from a dataset resource URL.
    
    This function downloads data from a resource URL and automatically parses
    it based on the detected or hinted format. Supports CSV, JSON, XML, Excel,
    and plain text formats with appropriate parsing for each.
    
    Args:
        resource_url (str): Direct URL to the data resource to download
        format_hint (str, optional): Format specification to override detection.
                                   Supported: 'csv', 'json', 'xml', 'xlsx', 'xls', 'txt'
        max_size (int, optional): Maximum file size in bytes. Defaults to MAX_RESOURCE_SIZE.
        json_file_path (str, optional): Path to save the resource data as a JSON file.
                                      If provided, the complete response with parsed data will be saved.
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the download and parsing was successful
            - data (Union[pd.DataFrame, dict, str]): Parsed data:
                - pandas DataFrame for CSV files
                - dict for JSON files  
                - dict with parsed structure for XML files
                - pandas DataFrame for Excel files
                - str for plain text files
            - metadata (dict): Information about the resource:
                - url (str): Original resource URL
                - format (str): Detected or specified format
                - size (int): Size in bytes
                - content_type (str): HTTP Content-Type header
                - encoding (str): Text encoding used
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the download fails or data cannot be parsed
        
    Example:
        >>> # Download CSV data
        >>> result = await fetch_resource_data("https://example.gov/data.csv")
        >>> if result['success']:
        ...     df = result['data']  # pandas DataFrame
        ...     print(f"Downloaded {len(df)} rows")
        
        >>> # Download JSON with format hint
        >>> result = await fetch_resource_data("https://example.gov/api/data", format_hint="json")
        >>> if result['success']:
        ...     data = result['data']  # dict
        ...     print(f"Keys: {list(data.keys())}")
    """
    
    # Validate inputs
    if not resource_url or not isinstance(resource_url, str):
        return {
            "success": False,
            "error": {
                "type": "validation_error",
                "message": "resource_url must be a non-empty string",
                "resource_url": resource_url
            }
        }
    
    resource_url = resource_url.strip()
    max_size = max_size or MAX_RESOURCE_SIZE
    
    # Validate URL format
    try:
        parsed_url = urllib.parse.urlparse(resource_url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return {
                "success": False,
                "error": {
                    "type": "url_validation_error",
                    "message": "Invalid URL format",
                    "resource_url": resource_url
                }
            }
        
        # Security check: prevent access to private/internal URLs
        if parsed_url.hostname and (
            parsed_url.hostname.startswith('127.') or
            parsed_url.hostname.startswith('10.') or
            parsed_url.hostname.startswith('192.168.') or
            parsed_url.hostname in ['localhost', '0.0.0.0'] or
            parsed_url.hostname.startswith('169.254.') or  # Link-local
            parsed_url.hostname.startswith('172.') and 16 <= int(parsed_url.hostname.split('.')[1]) <= 31
        ):
            return {
                "success": False,
                "error": {
                    "type": "security_error",
                    "message": "Access to private/internal URLs is not allowed",
                    "resource_url": resource_url
                }
            }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "url_parsing_error",
                "message": f"Failed to parse URL: {str(e)}",
                "resource_url": resource_url
            }
        }
    
    try:
        async with httpx.AsyncClient(timeout=RESOURCE_TIMEOUT, follow_redirects=True) as client:
            # First, make a HEAD request to check size and content type
            try:
                head_response = await client.head(resource_url)
                content_length = head_response.headers.get('content-length')
                content_type = head_response.headers.get('content-type', '').lower()
                
                # Check file size
                if content_length and int(content_length) > max_size:
                    return {
                        "success": False,
                        "error": {
                            "type": "size_error",
                            "message": f"Resource size ({int(content_length):,} bytes) exceeds limit ({max_size:,} bytes)",
                            "resource_url": resource_url,
                            "size": int(content_length),
                            "max_size": max_size
                        }
                    }
            except httpx.HTTPError:
                # HEAD request failed, continue with GET request
                content_type = ""
                content_length = None
            
            # Make the actual GET request
            response = await client.get(resource_url)
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": {
                        "type": "http_error",
                        "message": f"HTTP {response.status_code}: {response.reason_phrase}",
                        "status_code": response.status_code,
                        "resource_url": resource_url
                    }
                }
            
            # Get final content info
            content_type = response.headers.get('content-type', '').lower()
            actual_size = len(response.content)
            
            # Check actual size
            if actual_size > max_size:
                return {
                    "success": False,
                    "error": {
                        "type": "size_error",
                        "message": f"Resource size ({actual_size:,} bytes) exceeds limit ({max_size:,} bytes)",
                        "resource_url": resource_url,
                        "size": actual_size,
                        "max_size": max_size
                    }
                }
            
            # Determine format
            detected_format = _detect_format(resource_url, content_type, format_hint)
            
            # Parse the data based on format
            try:
                parsed_data = _parse_resource_data(response.content, detected_format, response.encoding)
                
                response_data = {
                    "success": True,
                    "data": parsed_data,
                    "metadata": {
                        "url": resource_url,
                        "format": detected_format,
                        "size": actual_size,
                        "content_type": content_type,
                        "encoding": response.encoding or 'utf-8'
                    }
                }
                
                # Save to JSON file if requested (backward compatibility)
                if json_file_path:
                    json_result = _save_to_json(response_data, json_file_path)
                    response_data.update(json_result)
                
                # Always save to AI_FILES directory
                response_data = save_to_file(response_data, function_name="fetch_resource_data")
                
                return response_data
                
            except Exception as e:
                return {
                    "success": False,
                    "error": {
                        "type": "parsing_error",
                        "message": f"Failed to parse {detected_format} data: {str(e)}",
                        "resource_url": resource_url,
                        "format": detected_format,
                        "size": actual_size
                    }
                }
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {RESOURCE_TIMEOUT} seconds",
                "resource_url": resource_url
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}",
                "resource_url": resource_url
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}",
                "resource_url": resource_url
            }
        }


def _detect_format(url: str, content_type: str, format_hint: Optional[str] = None) -> str:
    """
    Detect the format of a resource based on URL, content type, and hints.
    
    Args:
        url (str): Resource URL
        content_type (str): HTTP Content-Type header
        format_hint (str, optional): User-provided format hint
        
    Returns:
        str: Detected format ('csv', 'json', 'xml', 'xlsx', 'xls', 'txt')
    """
    # If format hint is provided, use it (with validation)
    if format_hint:
        format_hint = format_hint.lower().strip()
        if format_hint in ['csv', 'json', 'xml', 'xlsx', 'xls', 'txt']:
            return format_hint
    
    # Check content type first
    if 'json' in content_type:
        return 'json'
    elif 'csv' in content_type or 'comma-separated' in content_type:
        return 'csv'
    elif 'xml' in content_type:
        return 'xml'
    elif 'excel' in content_type or 'spreadsheet' in content_type:
        if 'sheet' in content_type:
            return 'xlsx'
        else:
            return 'xls'
    
    # Fall back to URL extension
    url_lower = url.lower()
    if url_lower.endswith('.csv'):
        return 'csv'
    elif url_lower.endswith('.json'):
        return 'json'
    elif url_lower.endswith('.xml'):
        return 'xml'
    elif url_lower.endswith('.xlsx'):
        return 'xlsx'
    elif url_lower.endswith('.xls'):
        return 'xls'
    elif url_lower.endswith(('.txt', '.text')):
        return 'txt'
    
    # Default to text if unable to detect
    return 'txt'


def _parse_resource_data(content: bytes, format_type: str, encoding: Optional[str] = None) -> Union[pd.DataFrame, Dict[str, Any], str]:
    """
    Parse resource data based on the specified format.
    
    Args:
        content (bytes): Raw content data
        format_type (str): Format to parse as
        encoding (str, optional): Text encoding to use
        
    Returns:
        Union[pd.DataFrame, Dict[str, Any], str]: Parsed data
        
    Raises:
        Exception: When parsing fails
    """
    encoding = encoding or 'utf-8'
    
    if format_type == 'csv':
        # Parse as CSV into pandas DataFrame
        text_content = content.decode(encoding, errors='replace')
        csv_buffer = io.StringIO(text_content)
        return pd.read_csv(csv_buffer)
    
    elif format_type == 'json':
        # Parse as JSON into dict
        text_content = content.decode(encoding, errors='replace')
        return json.loads(text_content)
    
    elif format_type == 'xml':
        # Parse as XML into dict structure
        text_content = content.decode(encoding, errors='replace')
        root = ET.fromstring(text_content)
        return _xml_to_dict(root)
    
    elif format_type in ['xlsx', 'xls']:
        # Parse Excel file into pandas DataFrame
        excel_buffer = io.BytesIO(content)
        return pd.read_excel(excel_buffer, engine='openpyxl' if format_type == 'xlsx' else None)
    
    elif format_type == 'txt':
        # Return as plain text
        return content.decode(encoding, errors='replace')
    
    else:
        # Unknown format, return as text
        return content.decode(encoding, errors='replace')


def _xml_to_dict(element: ET.Element) -> Dict[str, Any]:
    """
    Convert XML element to dictionary structure.
    
    Args:
        element (ET.Element): XML element to convert
        
    Returns:
        Dict[str, Any]: Dictionary representation
    """
    result = {}
    
    # Add attributes
    if element.attrib:
        result['@attributes'] = element.attrib
    
    # Add text content if present
    if element.text and element.text.strip():
        if len(element) == 0:  # Leaf node with text
            return element.text.strip()
        else:
            result['@text'] = element.text.strip()
    
    # Add child elements
    for child in element:
        child_data = _xml_to_dict(child)
        
        if child.tag in result:
            # Multiple elements with same tag - convert to list
            if not isinstance(result[child.tag], list):
                result[child.tag] = [result[child.tag]]
            result[child.tag].append(child_data)
        else:
            result[child.tag] = child_data
    
    return result if result else element.text


async def validate_resource_url_async(url: str, json_file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate if a resource URL is accessible and downloadable.
    
    This function performs a lightweight check to determine if a resource URL
    is accessible without downloading the full content. It uses a HEAD request
    to check accessibility and basic properties.
    
    Args:
        url (str): Resource URL to validate
        json_file_path (str, optional): Path to save the validation results as a JSON file.
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the validation was successful
            - accessible (bool): Whether the URL is accessible
            - url (str): The original URL that was validated
            - metadata (dict, optional): URL metadata if accessible:
                - status_code (int): HTTP status code
                - content_type (str): Content-Type header
                - content_length (int, optional): Content length in bytes
                - last_modified (str, optional): Last-Modified header
                - server (str, optional): Server header
            - error (dict, optional): Error information if validation failed
            
    Example:
        >>> validation = await validate_resource_url("https://example.gov/data.csv")
        >>> if validation['success'] and validation['accessible']:
        ...     print(f"URL is accessible, size: {validation['metadata'].get('content_length', 'unknown')}")
        >>> else:
        ...     print(f"URL is not accessible: {validation.get('error', {}).get('message', 'Unknown error')}")
    """
    
    # Validate input
    if not url or not isinstance(url, str):
        return {
            "success": False,
            "accessible": False,
            "url": url,
            "error": {
                "type": "validation_error",
                "message": "url must be a non-empty string"
            }
        }
    
    url = url.strip()
    
    # Basic URL format validation
    try:
        parsed_url = urllib.parse.urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return {
                "success": False,
                "accessible": False,
                "url": url,
                "error": {
                    "type": "url_format_error",
                    "message": "Invalid URL format"
                }
            }
        
        # Security check: prevent access to private/internal URLs
        if parsed_url.hostname and (
            parsed_url.hostname.startswith('127.') or
            parsed_url.hostname.startswith('10.') or
            parsed_url.hostname.startswith('192.168.') or
            parsed_url.hostname in ['localhost', '0.0.0.0'] or
            parsed_url.hostname.startswith('169.254.') or  # Link-local
            parsed_url.hostname.startswith('172.') and 16 <= int(parsed_url.hostname.split('.')[1]) <= 31
        ):
            return {
                "success": False,
                "accessible": False,
                "url": url,
                "error": {
                    "type": "security_error",
                    "message": "Access to private/internal URLs is not allowed"
                }
            }
    except Exception as e:
        return {
            "success": False,
            "accessible": False,
            "url": url,
            "error": {
                "type": "url_parsing_error",
                "message": f"Failed to parse URL: {str(e)}"
            }
        }
    
    # Perform HEAD request to check accessibility
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, follow_redirects=True) as client:
            response = await client.head(url)
            
            # Collect metadata
            metadata = {
                "status_code": response.status_code,
                "content_type": response.headers.get('content-type', ''),
                "server": response.headers.get('server', ''),
                "last_modified": response.headers.get('last-modified', ''),
            }
            
            # Add content length if available
            content_length = response.headers.get('content-length')
            if content_length:
                try:
                    metadata["content_length"] = int(content_length)
                except ValueError:
                    metadata["content_length"] = content_length
            
            # Check if the URL is accessible (2xx status codes)
            is_accessible = 200 <= response.status_code < 300
            
            response_data = {
                "success": True,
                "accessible": is_accessible,
                "url": url,
                "metadata": metadata
            }
            
            # Save to JSON file if requested (backward compatibility)
            if json_file_path:
                json_result = _save_to_json(response_data, json_file_path)
                response_data.update(json_result)
            
            # Always save to AI_FILES directory
            response_data = save_to_file(response_data, function_name="validate_resource_url")
            
            return response_data
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "accessible": False,
            "url": url,
            "error": {
                "type": "timeout_error",
                "message": f"Request timed out after {DEFAULT_TIMEOUT} seconds"
            }
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "accessible": False,
            "url": url,
            "error": {
                "type": "request_error",
                "message": f"Request failed: {str(e)}"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "accessible": False,
            "url": url,
            "error": {
                "type": "unexpected_error",
                "message": f"Unexpected error occurred: {str(e)}"
            }
        }


async def get_package_resources_async(package_id: str, json_file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract all resource URLs and metadata from a package.
    
    This function retrieves detailed information about a specific package
    and extracts all its resources with their URLs, formats, and descriptions.
    This is useful for discovering what downloadable data is available
    in a dataset before actually downloading it.
    
    Args:
        package_id (str): Unique identifier or name of the package to get resources for
        json_file_path (str, optional): Path to save the resource list as a JSON file.
                                      If provided, the complete response will be saved.
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - resources (list): List of resource dictionaries, each containing:
                - id (str): Resource UUID
                - name (str): Resource name/title
                - description (str): Resource description
                - url (str): Direct download URL
                - format (str): File format (CSV, JSON, XML, etc.)
                - size (int, optional): File size in bytes if available
                - created (str): Creation timestamp
                - last_modified (str): Last modification timestamp
                - mimetype (str, optional): MIME type if available
                - cache_url (str, optional): Cached URL if available
            - package_info (dict): Basic package information:
                - id (str): Package UUID
                - name (str): Package name
                - title (str): Package title
                - organization (str): Organization name
            - count (int): Total number of resources found
            - error (dict, optional): Error information if request failed
            
    Raises:
        APIError: When the package cannot be found or accessed
        
    Example:
        >>> resources = await get_package_resources("electric-vehicle-population-data")
        >>> if resources['success']:
        ...     print(f"Found {resources['count']} resources:")
        ...     for resource in resources['resources']:
        ...         print(f"- {resource['name']} ({resource['format']}) - {resource['url']}")
    """
    
    # Validate package_id parameter
    if not package_id or not isinstance(package_id, str):
        return {
            "success": False,
            "error": {
                "type": "validation_error",
                "message": "package_id must be a non-empty string",
                "package_id": package_id
            }
        }
    
    # Get package details using existing function
    package_details = await get_package_details_async(package_id.strip())
    
    # Check if package details retrieval was successful
    if not package_details.get("success", False):
        # Pass through the error from get_package_details
        return {
            "success": False,
            "error": package_details.get("error", {
                "type": "package_retrieval_error",
                "message": "Failed to retrieve package details",
                "package_id": package_id
            }),
            "package_id": package_id
        }
    
    # Extract package data
    package_data = package_details.get("result", {})
    
    if not package_data:
        return {
            "success": False,
            "error": {
                "type": "empty_response_error",
                "message": "Package details response was empty",
                "package_id": package_id
            }
        }
    
    # Extract resources from package data
    raw_resources = package_data.get("resources", [])
    
    # Process and clean up resource information
    processed_resources = []
    for resource in raw_resources:
        if not isinstance(resource, dict):
            continue
            
        processed_resource = {
            "id": resource.get("id", ""),
            "name": resource.get("name", resource.get("description", "Unnamed Resource")),
            "description": resource.get("description", ""),
            "url": resource.get("url", ""),
            "format": resource.get("format", "").upper() if resource.get("format") else "UNKNOWN",
            "created": resource.get("created", ""),
            "last_modified": resource.get("last_modified", resource.get("revision_timestamp", "")),
            "mimetype": resource.get("mimetype", ""),
            "cache_url": resource.get("cache_url", ""),
            "resource_type": resource.get("resource_type", ""),
            "state": resource.get("state", ""),
            "hash": resource.get("hash", "")
        }
        
        # Add size if available (may be string or int)
        if resource.get("size"):
            try:
                processed_resource["size"] = int(resource["size"])
            except (ValueError, TypeError):
                # If size can't be converted to int, store as string
                processed_resource["size"] = str(resource["size"])
        
        # Only include resources with valid URLs
        if processed_resource["url"] and processed_resource["url"].startswith(('http://', 'https://')):
            processed_resources.append(processed_resource)
    
    # Prepare package summary information
    organization = package_data.get("organization", {})
    package_info = {
        "id": package_data.get("id", ""),
        "name": package_data.get("name", ""),
        "title": package_data.get("title", ""),
        "organization": organization.get("title", organization.get("name", "")) if organization else "",
        "organization_id": organization.get("id", "") if organization else "",
        "metadata_created": package_data.get("metadata_created", ""),
        "metadata_modified": package_data.get("metadata_modified", ""),
        "state": package_data.get("state", ""),
        "type": package_data.get("type", "")
    }
    
    response_data = {
        "success": True,
        "resources": processed_resources,
        "package_info": package_info,
        "count": len(processed_resources),
        "package_id": package_id,
        "total_raw_resources": len(raw_resources),  # Including invalid ones for debugging
        "formats_available": list(set(res["format"] for res in processed_resources if res["format"] != "UNKNOWN"))
    }
    
    # Save to JSON file if requested (backward compatibility)
    if json_file_path:
        json_result = _save_to_json(response_data, json_file_path)
        response_data.update(json_result)
    
    # Always save to AI_FILES directory
    response_data = save_to_file(response_data, function_name="get_package_resources")
    
    return response_data


@tool
def build_search_query(**criteria) -> str:
    """
    Helper function to build complex CKAN search queries.
    
    This function takes various search criteria and builds a properly formatted
    CKAN search query string that can be used with the search_packages function.
    It supports keyword searches, organization filtering, format filtering,
    tag filtering, and more advanced CKAN query syntax.
    
    Args:
        **criteria: Various search criteria including:
            - keywords (str): Basic keyword search terms
            - organization (str): Filter by organization name or ID
            - tags (list or str): Filter by tags (single tag string or list of tags)
            - format (str): Filter by resource format (CSV, JSON, etc.)
            - license_id (str): Filter by license identifier
            - groups (list or str): Filter by groups (single group or list of groups)
            - author (str): Filter by dataset author
            - maintainer (str): Filter by dataset maintainer
            - title (str): Search in dataset titles
            - notes (str): Search in dataset descriptions/notes
            - extras (dict): Additional metadata field filters
            - date_created_start (str): Filter datasets created after this date (ISO format)
            - date_created_end (str): Filter datasets created before this date (ISO format)
            - date_modified_start (str): Filter datasets modified after this date (ISO format)
            - date_modified_end (str): Filter datasets modified before this date (ISO format)
    
    Returns:
        str: Formatted CKAN query string that can be used with search_packages
        
    Example:
        >>> # Simple keyword search
        >>> query = build_search_query(keywords="climate data")
        >>> print(query)  # "climate data"
        
        >>> # Complex search with filters
        >>> query = build_search_query(
        ...     keywords="transportation",
        ...     organization="dot-gov",
        ...     format="CSV",
        ...     tags=["public-transit", "roads"]
        ... )
        >>> print(query)  # Complex formatted query string
        
        >>> # Search by metadata fields
        >>> query = build_search_query(
        ...     title="population",
        ...     author="census bureau",
        ...     date_created_start="2023-01-01"
        ... )
    """
    
    query_parts = []
    
    # Handle basic keyword search
    keywords = criteria.get('keywords', '').strip()
    if keywords:
        # If keywords contain special characters, quote them
        if any(char in keywords for char in ['"', '(', ')', ':', ' AND ', ' OR ', ' NOT ']):
            # Already contains query operators, use as-is
            query_parts.append(keywords)
        else:
            # Simple keywords, add as-is
            query_parts.append(keywords)
    
    # Build field-specific searches
    field_searches = []
    
    # Title search
    title = criteria.get('title', '').strip()
    if title:
        field_searches.append(f'title:"{title}"')
    
    # Notes/description search  
    notes = criteria.get('notes', '').strip()
    if notes:
        field_searches.append(f'notes:"{notes}"')
    
    # Author search
    author = criteria.get('author', '').strip()
    if author:
        field_searches.append(f'author:"{author}"')
    
    # Maintainer search
    maintainer = criteria.get('maintainer', '').strip()
    if maintainer:
        field_searches.append(f'maintainer:"{maintainer}"')
    
    # Organization filter
    organization = criteria.get('organization', '').strip()
    if organization:
        field_searches.append(f'organization:"{organization}"')
    
    # License filter
    license_id = criteria.get('license_id', '').strip()
    if license_id:
        field_searches.append(f'license_id:"{license_id}"')
    
    # Format filter (applied to resources)
    format_filter = criteria.get('format', '').strip()
    if format_filter:
        field_searches.append(f'res_format:"{format_filter.upper()}"')
    
    # Tags filter
    tags = criteria.get('tags')
    if tags:
        if isinstance(tags, str):
            tags = [tags]
        if isinstance(tags, list):
            for tag in tags:
                if tag and isinstance(tag, str):
                    field_searches.append(f'tags:"{tag.strip()}"')
    
    # Groups filter
    groups = criteria.get('groups')
    if groups:
        if isinstance(groups, str):
            groups = [groups]
        if isinstance(groups, list):
            for group in groups:
                if group and isinstance(group, str):
                    field_searches.append(f'groups:"{group.strip()}"')
    
    # Date filters
    date_created_start = criteria.get('date_created_start', '').strip()
    if date_created_start:
        field_searches.append(f'metadata_created:[{date_created_start} TO *]')
    
    date_created_end = criteria.get('date_created_end', '').strip()
    if date_created_end:
        field_searches.append(f'metadata_created:[* TO {date_created_end}]')
    
    date_modified_start = criteria.get('date_modified_start', '').strip()
    if date_modified_start:
        field_searches.append(f'metadata_modified:[{date_modified_start} TO *]')
    
    date_modified_end = criteria.get('date_modified_end', '').strip()
    if date_modified_end:
        field_searches.append(f'metadata_modified:[* TO {date_modified_end}]')
    
    # Handle extras (additional metadata fields)
    extras = criteria.get('extras')
    if extras and isinstance(extras, dict):
        for key, value in extras.items():
            if key and value and isinstance(key, str):
                field_searches.append(f'extras_{key}:"{value}"')
    
    # Combine all parts
    all_parts = query_parts + field_searches
    
    if not all_parts:
        return "*"  # Return wildcard if no criteria provided
    
    # Join with AND to create the final query
    final_query = " AND ".join(all_parts)
    
    return final_query


@tool
def get_catalog_info() -> Dict[str, Any]:
    """
    Get basic information about the Data.gov catalog without slow operations.
    
    This function provides a quick overview of the catalog including the number
    of organizations and basic statistics, without fetching the full list of tags
    which can be extremely slow.
    
    Returns:
        Dict[str, Any]: Dictionary containing:
            - success (bool): Whether the request was successful
            - organizations (dict): Organization information with count and list
            - tags_info (dict): Information about tags endpoint performance
            - summary (str): Human-readable summary
            
    Example:
        >>> info = get_catalog_info()
        >>> print(info['summary'])
        >>> print(f"Organizations: {info['organizations']['count']}")
    """
    try:
        # Get organizations (fast)
        groups_result = list_groups_sync(all_fields=True)
        
        if not groups_result["success"]:
            return {
                "success": False,
                "error": groups_result["error"]
            }
        
        orgs = groups_result["result"]
        total_datasets = sum(org.get("package_count", 0) for org in orgs)
        
        # Find top organizations
        top_orgs = sorted(orgs, key=lambda x: x.get("package_count", 0), reverse=True)[:5]
        
        response_data = {
            "success": True,
            "organizations": {
                "count": len(orgs),
                "list": [org.get("title", org.get("name", "")) for org in orgs],
                "total_datasets": total_datasets,
                "top_organizations": [
                    {
                        "name": org.get("title", org.get("name", "")),
                        "datasets": org.get("package_count", 0)
                    } for org in top_orgs
                ]
            },
            "tags_info": {
                "warning": "Tags endpoint is very slow (up to 2 minutes)",
                "recommendation": "Use search_packages() with specific queries instead of fetching all tags",
                "estimated_count": "100,000+ tags (estimate based on catalog size)"
            },
            "summary": f"Data.gov catalog contains {len(orgs)} organizations with {total_datasets:,} total datasets. Tag listing is available but very slow."
        }
        
        # Always save to AI_FILES directory
        response_data = save_to_file(response_data, function_name="get_catalog_info")
        
        return response_data
        
    except Exception as e:
        return {
            "success": False,
            "error": {
                "type": "unexpected_error", 
                "message": str(e)
            }
        }


# Synchronous wrapper for backwards compatibility
def search_packages_sync(
    query: str, 
    rows: int = 10, 
    start: int = 0, 
    **filters
) -> Dict[str, Any]:
    """
    Synchronous wrapper for search_packages function.
    
    Args:
        query (str): Search terms
        rows (int, optional): Number of results to return. Defaults to 10.
        start (int, optional): Starting index for pagination. Defaults to 0.
        **filters: Additional CKAN filters
    
    Returns:
        Dict[str, Any]: Same format as async search_packages
    """
    import asyncio
    
    # Create parameter dictionary for the tool
    params = {"query": query, "rows": rows, "start": start}
    params.update(filters)
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            # Call the original async function directly, not the tool
            return loop.run_until_complete(search_packages_async(query, rows, start, **filters))
        else:
            return loop.run_until_complete(search_packages_async(query, rows, start, **filters))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(search_packages_async(query, rows, start, **filters))
        finally:
            loop.close()


def get_package_details_sync(package_id: str, **options) -> Dict[str, Any]:
    """
    Synchronous wrapper for get_package_details function.
    
    Args:
        package_id (str): Unique identifier or name of the package
        **options: Additional CKAN package_show parameters
    
    Returns:
        Dict[str, Any]: Same format as async get_package_details
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(get_package_details_async(package_id, **options))
        else:
            return loop.run_until_complete(get_package_details_async(package_id, **options))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(get_package_details_async(package_id, **options))
        finally:
            loop.close()


def list_groups_sync(**options) -> Dict[str, Any]:
    """
    Synchronous wrapper for list_groups function.
    
    Args:
        **options: Additional CKAN group_list parameters
    
    Returns:
        Dict[str, Any]: Same format as async list_groups
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(list_groups_async(**options))
        else:
            return loop.run_until_complete(list_groups_async(**options))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(list_groups_async(**options))
        finally:
            loop.close()


def list_tags_sync(**options) -> Dict[str, Any]:
    """
    Synchronous wrapper for list_tags function.
    
    Args:
        **options: Additional CKAN tag_list parameters
    
    Returns:
        Dict[str, Any]: Same format as async list_tags
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(list_tags_async(**options))
        else:
            return loop.run_until_complete(list_tags_async(**options))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(list_tags_async(**options))
        finally:
            loop.close()


def fetch_resource_data_sync(
    resource_url: str, 
    format_hint: Optional[str] = None,
    max_size: Optional[int] = None
) -> Dict[str, Any]:
    """
    Synchronous wrapper for fetch_resource_data function.
    
    Args:
        resource_url (str): Direct URL to the data resource to download
        format_hint (str, optional): Format specification to override detection
        max_size (int, optional): Maximum file size in bytes
    
    Returns:
        Dict[str, Any]: Same format as async fetch_resource_data
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(fetch_resource_data_async(resource_url, format_hint, max_size))
        else:
            return loop.run_until_complete(fetch_resource_data_async(resource_url, format_hint, max_size))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(fetch_resource_data_async(resource_url, format_hint, max_size))
        finally:
            loop.close()


def get_package_resources_sync(package_id: str) -> Dict[str, Any]:
    """
    Synchronous wrapper for get_package_resources function.
    
    Args:
        package_id (str): Unique identifier or name of the package to get resources for
    
    Returns:
        Dict[str, Any]: Same format as async get_package_resources
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(get_package_resources_async(package_id))
        else:
            return loop.run_until_complete(get_package_resources_async(package_id))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(get_package_resources_async(package_id))
        finally:
            loop.close()


def validate_resource_url_sync(url: str) -> Dict[str, Any]:
    """
    Synchronous wrapper for validate_resource_url function.
    
    Args:
        url (str): Resource URL to validate
    
    Returns:
        Dict[str, Any]: Same format as async validate_resource_url
    """
    import asyncio
    
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running, we need to use a different approach
            # This typically happens in Jupyter notebooks or when called from async context
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(validate_resource_url_async(url))
        else:
            return loop.run_until_complete(validate_resource_url_async(url))
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(validate_resource_url_async(url))
        finally:
            loop.close()


# ========================
# LangChain Tool Wrappers
# ========================

@tool
def search_packages_simple(query: str, rows: int = 10) -> Dict[str, Any]:
    """
    Search for datasets on Data.gov using simple parameters.
    
    Args:
        query: Search terms to look for in dataset titles, descriptions, and content
        rows: Number of results to return (max 1000)
    
    Returns:
        Dictionary containing search results with 'success', 'result' keys
    """
    return search_packages_sync(query, rows)


@tool  
def search_packages_by_organization(query: str, organization: str, rows: int = 10) -> Dict[str, Any]:
    """
    Search for datasets from a specific organization on Data.gov.
    
    Args:
        query: Search terms to look for
        organization: Organization name to filter by (e.g., 'epa-gov', 'noaa-gov')
        rows: Number of results to return
        
    Returns:
        Dictionary containing filtered search results
    """
    return search_packages_sync(query, rows, fq=f"organization:{organization}")


@tool
def search_packages_by_format(query: str, format_type: str, rows: int = 10) -> Dict[str, Any]:
    """
    Search for datasets with specific file format on Data.gov.
    
    Args:
        query: Search terms to look for
        format_type: File format to filter by (e.g., 'CSV', 'JSON', 'XML')
        rows: Number of results to return
        
    Returns:
        Dictionary containing search results filtered by format
    """
    return search_packages_sync(query, rows, fq=f"res_format:{format_type.upper()}")


@tool
def get_recent_datasets(query: str = "*", days: int = 30, rows: int = 10) -> Dict[str, Any]:
    """
    Get recently created or modified datasets from Data.gov.
    
    Args:
        query: Search terms (use "*" for all datasets)
        days: Number of days back to search (default 30)
        rows: Number of results to return
        
    Returns:
        Dictionary containing recent datasets
    """
    from datetime import datetime, timedelta
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    date_filter = f"metadata_modified:[{start_date.isoformat()}Z TO {end_date.isoformat()}Z]"
    return search_packages_sync(query, rows, fq=date_filter, sort="metadata_modified desc")


@tool
def get_organization_datasets(organization_name: str, rows: int = 20) -> Dict[str, Any]:
    """
    Get all datasets from a specific organization.
    
    Args:
        organization_name: Name of the organization (e.g., 'epa-gov', 'dot-gov')
        rows: Number of results to return
        
    Returns:
        Dictionary containing organization's datasets
    """
    return search_packages_sync("*", rows, fq=f"organization:{organization_name}")


@tool
def get_datasets_by_tag(tag: str, rows: int = 20) -> Dict[str, Any]:
    """
    Get datasets that have a specific tag.
    
    Args:
        tag: Tag to search for (e.g., 'climate', 'transportation', 'health')
        rows: Number of results to return
        
    Returns:
        Dictionary containing tagged datasets
    """
    return search_packages_sync("*", rows, fq=f"tags:{tag}")


@tool
def validate_and_get_resource_info(resource_url: str) -> Dict[str, Any]:
    """
    Validate a resource URL and get basic information about it.
    
    Args:
        resource_url: URL of the resource to validate
        
    Returns:
        Dictionary with validation results and metadata
    """
    return validate_resource_url_sync(resource_url)


@tool
def download_small_dataset(resource_url: str, format_hint: str = None) -> Dict[str, Any]:
    """
    Download and parse a small dataset (max 10MB) from a resource URL.
    Also saves the raw CSV file to the AI_FILES directory.
    
    Args:
        resource_url: Direct URL to the data resource
        format_hint: Expected format ('csv', 'json', 'xml') to override detection
        
    Returns:
        Dictionary with parsed data, metadata, and information about saved files
    """
    print("Downloading a section of the database...")
    
    # Get the parsed data and metadata from existing function
    result = fetch_resource_data_sync(resource_url, format_hint, max_size=10*1024*1024)
    
    # If successful and we have CSV data, also save the raw CSV file
    if result.get('success') and result.get('metadata', {}).get('format') == 'csv':
        try:
            import httpx
            import urllib.parse
            from datetime import datetime
            from pathlib import Path
            
            # Download the raw CSV content
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                response = client.get(resource_url)
                if response.status_code == 200:
                    # Generate filename for CSV
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    _file_counter["value"] += 1
                    
                    # Extract filename from URL or use generic name
                    parsed_url = urllib.parse.urlparse(resource_url)
                    original_filename = Path(parsed_url.path).stem or "dataset"
                    csv_filename = f"{original_filename}_{timestamp}_{_file_counter['value']:04d}.csv"
                    
                    # Save to AI_FILES directory
                    csv_file_path = Path(AI_FILES_DIR) / csv_filename
                    csv_file_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    with open(csv_file_path, 'wb') as f:
                        f.write(response.content)
                    
                    # Add CSV save information to result
                    result['csv_saved'] = True
                    result['csv_file_path'] = str(csv_file_path.absolute())
                    result['csv_file_size'] = len(response.content)
                    result['csv_filename'] = csv_filename
                    
                    print(f"CSV file saved to: {csv_file_path}")
                    
                    csv_status: Dict[str, dict] = {}
                    csv_status[csv_filename] = {"ready": True, "path": str(csv_file_path.absolute())}
                    with open("csv_status.json", "w") as f:
                        json.dump(csv_status, f)
                    
                
        except Exception as e:
            # Don't fail the whole operation if CSV saving fails
            result['csv_saved'] = False
            result['csv_error'] = str(e)
            print(f"Warning: Failed to save CSV file: {e}")
    
    return result


# ========================
# LangChain Tool Decorators (Async-only for compatibility)
# ========================

# Using @tool decorator for better compatibility with LangGraph agents
@tool
async def search_packages(query: str, limit: int = 20) -> Dict[str, Any]:
    """Search for datasets using the CKAN package_search endpoint."""
    return await search_packages_async(query, limit)

@tool 
async def get_package_details(package_id: str) -> Dict[str, Any]:
    """Retrieve detailed information about a specific dataset."""
    return await get_package_details_async(package_id)

@tool
async def list_groups(limit: int = 100) -> Dict[str, Any]:
    """Retrieve all available groups/organizations in the Data.gov catalog."""
    return await list_groups_async(limit)

@tool
async def list_tags(query: str = "", limit: int = 100) -> Dict[str, Any]:
    """Retrieve all available tags used across datasets in the Data.gov catalog."""
    return await list_tags_async(query, limit)

@tool
async def fetch_resource_data(resource_url: str, max_size_mb: int = 50) -> Dict[str, Any]:
    """Download and parse data from a dataset resource URL."""
    return await fetch_resource_data_async(resource_url, max_size_mb)

@tool
async def validate_resource_url(resource_url: str) -> Dict[str, Any]:
    """Validate if a resource URL is accessible and downloadable."""
    return await validate_resource_url_async(resource_url)

@tool
async def get_package_resources(package_id: str) -> Dict[str, Any]:
    """Extract all resource URLs and metadata from a package."""
    return await get_package_resources_async(package_id)

# Collection of all Data.gov tools for easy import
DATA_GOV_TOOLS = [
    search_packages_simple,
    search_packages_by_organization, 
    search_packages_by_format,
    get_recent_datasets,
    get_organization_datasets,
    get_datasets_by_tag,
    get_package_details,
    get_package_resources,
    list_groups,
    list_tags, 
    validate_and_get_resource_info,
    download_small_dataset,
    build_search_query,
    get_catalog_info,
    # Async-compatible tools using @tool decorator
    search_packages,
    fetch_resource_data,
    validate_resource_url
]




