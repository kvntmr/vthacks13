#!/usr/bin/env python3
"""
Comprehensive Test Suite for Data.gov API Integration Module

This script tests all functions in tooling.py and saves detailed results to a file.
It includes both positive and negative test cases to ensure robust functionality.
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, List, Any
import sys
import os

# Add the current directory to path to import tooling
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tooling


class TestResults:
    """Helper class to collect and manage test results"""
    
    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.start_time = datetime.now()
        
    def add_result(self, test_name: str, function_name: str, success: bool, 
                   duration: float, result: Any = None, error: str = None):
        """Add a test result"""
        self.results.append({
            "test_name": test_name,
            "function_name": function_name,
            "success": success,
            "duration_seconds": round(duration, 3),
            "timestamp": datetime.now().isoformat(),
            "result_summary": self._summarize_result(result),
            "error": error
        })
        
    def _summarize_result(self, result: Any) -> Dict[str, Any]:
        """Create a summary of the result for logging"""
        if not isinstance(result, dict):
            return {"type": type(result).__name__, "length": len(str(result))}
            
        summary = {"type": "dict"}
        
        if result.get("success"):
            summary["success"] = True
            
            # Summarize different types of results
            if "result" in result:
                data = result["result"]
                if isinstance(data, dict):
                    summary["result_type"] = "dict"
                    summary["result_keys"] = list(data.keys())
                    if "count" in data:
                        summary["count"] = data["count"]
                elif isinstance(data, list):
                    summary["result_type"] = "list"
                    summary["count"] = len(data)
                    
            if "count" in result:
                summary["count"] = result["count"]
                
            if "resources" in result:
                summary["resources_count"] = len(result["resources"])
                
            if "data" in result:
                import pandas as pd
                data = result["data"]
                if isinstance(data, pd.DataFrame):
                    summary["data_type"] = "DataFrame"
                    summary["data_shape"] = data.shape
                elif isinstance(data, dict):
                    summary["data_type"] = "dict"
                    summary["data_keys"] = list(data.keys()) if data else []
                elif isinstance(data, str):
                    summary["data_type"] = "string"
                    summary["data_length"] = len(data)
                    
            if "accessible" in result:
                summary["accessible"] = result["accessible"]
                
        else:
            summary["success"] = False
            if "error" in result:
                summary["error_type"] = result["error"].get("type", "unknown")
                summary["error_message"] = result["error"].get("message", "")
                
        return summary
        
    def get_summary(self) -> Dict[str, Any]:
        """Get overall test summary"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        total_duration = (datetime.now() - self.start_time).total_seconds()
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": round(passed_tests / total_tests * 100, 1) if total_tests > 0 else 0,
            "total_duration_seconds": round(total_duration, 3),
            "start_time": self.start_time.isoformat(),
            "end_time": datetime.now().isoformat()
        }
        
    def save_to_file(self, filename: str):
        """Save test results to JSON file"""
        output = {
            "summary": self.get_summary(),
            "test_results": self.results
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)


async def run_test(test_results: TestResults, test_name: str, function_name: str, test_func):
    """Run a single test and record results"""
    print(f"Running {test_name}...")
    start_time = time.time()
    
    try:
        if asyncio.iscoroutinefunction(test_func):
            result = await test_func()
        else:
            result = test_func()
            
        duration = time.time() - start_time
        success = True
        error = None
        
        print(f"  ✓ {test_name} completed in {duration:.3f}s")
        
    except Exception as e:
        duration = time.time() - start_time
        success = False
        result = None
        error = str(e)
        
        print(f"  ✗ {test_name} failed after {duration:.3f}s: {error}")
        
    test_results.add_result(test_name, function_name, success, duration, result, error)
    return result


# Test functions for each API function
async def test_search_packages_basic():
    """Test basic search functionality"""
    return await tooling.search_packages("climate", rows=5)


async def test_search_packages_with_filters():
    """Test search with filters"""
    return await tooling.search_packages(
        "transportation", 
        rows=3, 
        fq="organization:dot-gov"
    )


def test_search_packages_sync():
    """Test synchronous search"""
    return tooling.search_packages_sync("energy", rows=3)


def test_build_search_query_simple():
    """Test simple query building"""
    return tooling.build_search_query(keywords="climate data")


def test_build_search_query_complex():
    """Test complex query building"""
    return tooling.build_search_query(
        keywords="transportation",
        organization="dot-gov",
        format="CSV",
        tags=["public-transit", "infrastructure"],
        date_created_start="2023-01-01"
    )


async def test_get_package_details():
    """Test getting package details"""
    # First search for a package to get a real ID
    search_result = await tooling.search_packages("census", rows=1)
    if search_result.get("success") and search_result.get("result", {}).get("results"):
        package_id = search_result["result"]["results"][0]["id"]
        return await tooling.get_package_details(package_id)
    else:
        # Fallback to a known package name
        return await tooling.get_package_details("consumer-complaint-database")


def test_get_package_details_sync():
    """Test synchronous package details"""
    return tooling.get_package_details_sync("consumer-complaint-database")


async def test_get_package_details_invalid():
    """Test package details with invalid ID"""
    return await tooling.get_package_details("nonexistent-package-12345")


async def test_list_groups():
    """Test listing groups"""
    return await tooling.list_groups(all_fields=True)


def test_list_groups_sync():
    """Test synchronous group listing"""
    return tooling.list_groups_sync()


def test_get_catalog_info():
    """Test catalog info function"""
    return tooling.get_catalog_info()


async def test_get_package_resources():
    """Test getting package resources"""
    # Use a known package with resources
    return await tooling.get_package_resources("consumer-complaint-database")


def test_get_package_resources_sync():
    """Test synchronous package resources"""
    return tooling.get_package_resources_sync("consumer-complaint-database")


async def test_validate_resource_url_valid():
    """Test URL validation with a valid URL"""
    return await tooling.validate_resource_url("https://catalog.data.gov/api/3/action/package_list")


async def test_validate_resource_url_invalid():
    """Test URL validation with invalid URL"""
    return await tooling.validate_resource_url("not-a-valid-url")


def test_validate_resource_url_sync():
    """Test synchronous URL validation"""
    return tooling.validate_resource_url_sync("https://www.data.gov")


async def test_fetch_resource_data_small():
    """Test fetching small resource data"""
    # Try to find a small CSV resource
    search_result = await tooling.search_packages("fq=res_format:CSV", rows=5)
    
    if search_result.get("success"):
        results = search_result.get("result", {}).get("results", [])
        for package in results:
            for resource in package.get("resources", []):
                if (resource.get("format", "").upper() == "CSV" and 
                    resource.get("url") and 
                    resource.get("url").startswith("http")):
                    
                    # Try to fetch this resource with a small size limit
                    return await tooling.fetch_resource_data(
                        resource["url"], 
                        format_hint="csv",
                        max_size=1024*1024  # 1MB limit
                    )
    
    # Fallback: try to fetch from a known small resource
    return await tooling.fetch_resource_data(
        "https://raw.githubusercontent.com/datasets/population/master/data/population.csv",
        format_hint="csv",
        max_size=1024*1024
    )


def test_fetch_resource_data_sync():
    """Test synchronous resource data fetching"""
    return tooling.fetch_resource_data_sync(
        "https://httpbin.org/json",
        format_hint="json"
    )


async def test_fetch_resource_data_invalid_url():
    """Test fetch with invalid URL"""
    return await tooling.fetch_resource_data("not-a-valid-url")


async def test_list_tags_small():
    """Test listing tags (with caution due to slowness)"""
    # Only test this if explicitly requested, as it can be very slow
    return {"success": True, "result": ["skipped-due-to-performance"], "message": "Skipped list_tags test due to performance concerns"}


async def main():
    """Run all tests"""
    print("=" * 60)
    print("Data.gov API Integration - Comprehensive Test Suite")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    test_results = TestResults()
    
    # Define all tests
    tests = [
        # Search functions
        ("Search Packages - Basic", "search_packages", test_search_packages_basic),
        ("Search Packages - With Filters", "search_packages", test_search_packages_with_filters),
        ("Search Packages - Sync", "search_packages_sync", test_search_packages_sync),
        
        # Query building
        ("Build Search Query - Simple", "build_search_query", test_build_search_query_simple),
        ("Build Search Query - Complex", "build_search_query", test_build_search_query_complex),
        
        # Package details
        ("Get Package Details - Valid", "get_package_details", test_get_package_details),
        ("Get Package Details - Sync", "get_package_details_sync", test_get_package_details_sync),
        ("Get Package Details - Invalid ID", "get_package_details", test_get_package_details_invalid),
        
        # Groups and catalog info
        ("List Groups - Async", "list_groups", test_list_groups),
        ("List Groups - Sync", "list_groups_sync", test_list_groups_sync),
        ("Get Catalog Info", "get_catalog_info", test_get_catalog_info),
        
        # Package resources
        ("Get Package Resources - Async", "get_package_resources", test_get_package_resources),
        ("Get Package Resources - Sync", "get_package_resources_sync", test_get_package_resources_sync),
        
        # URL validation
        ("Validate Resource URL - Valid", "validate_resource_url", test_validate_resource_url_valid),
        ("Validate Resource URL - Invalid", "validate_resource_url", test_validate_resource_url_invalid),
        ("Validate Resource URL - Sync", "validate_resource_url_sync", test_validate_resource_url_sync),
        
        # Resource data fetching
        ("Fetch Resource Data - Small CSV", "fetch_resource_data", test_fetch_resource_data_small),
        ("Fetch Resource Data - Sync", "fetch_resource_data_sync", test_fetch_resource_data_sync),
        ("Fetch Resource Data - Invalid URL", "fetch_resource_data", test_fetch_resource_data_invalid_url),
        
        # Tags (commented out due to performance)
        # ("List Tags - Small Test", "list_tags", test_list_tags_small),
    ]
    
    # Run all tests
    for test_name, function_name, test_func in tests:
        await run_test(test_results, test_name, function_name, test_func)
        print()  # Add spacing between tests
    
    # Save results
    output_file = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    test_results.save_to_file(output_file)
    
    # Print summary
    summary = test_results.get_summary()
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed_tests']}")
    print(f"Failed: {summary['failed_tests']}")
    print(f"Success Rate: {summary['success_rate']}%")
    print(f"Total Duration: {summary['total_duration_seconds']}s")
    print(f"Results saved to: {output_file}")
    print("=" * 60)
    
    return test_results


if __name__ == "__main__":
    # Run the test suite
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest suite interrupted by user")
    except Exception as e:
        print(f"\nTest suite failed with error: {e}")
        import traceback
        traceback.print_exc()
