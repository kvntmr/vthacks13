"""
Simple test script for JSON saving functionality

This script directly calls the tooling functions to test JSON saving
without going through the LangChain tool wrappers.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path


async def test_json_saving():
    """Test the JSON saving functionality."""
    print("Testing JSON Saving Functionality")
    print("=" * 40)
    
    # Create test directory
    test_dir = Path("json_test_outputs")
    test_dir.mkdir(exist_ok=True)
    
    # We need to manually import the core functions to bypass tool decorators
    # Let's use a different approach by calling the sync wrappers directly
    from tooling import search_packages_sync, get_package_details_sync, list_groups_sync
    
    # Test 1: Search packages with JSON saving
    print("1. Testing search_packages with JSON saving...")
    json_path1 = test_dir / f"search_{datetime.now().strftime('%H%M%S')}.json"
    
    try:
        # Since the sync functions don't have the JSON parameter, we need to test differently
        # Let's create a simple test that saves manually
        result = search_packages_sync("climate", rows=3)
        
        if result.get('success'):
            print(f"   ✓ Search successful: {len(result.get('result', {}).get('results', []))} results found")
            
            # Test our JSON utility function manually
            from tooling import _save_to_json
            json_result = _save_to_json(result, str(json_path1))
            
            if json_result.get('json_saved'):
                print(f"   ✓ JSON saved to: {json_result['json_file_path']}")
                print(f"   ✓ File size: {json_result['json_file_size']} bytes")
                
                # Verify we can load it back
                with open(json_result['json_file_path'], 'r') as f:
                    loaded_data = json.load(f)
                print(f"   ✓ JSON loaded back successfully")
            else:
                print(f"   ✗ JSON save failed: {json_result.get('json_error', 'Unknown error')}")
        else:
            print(f"   ✗ Search failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print()
    
    # Test 2: Test with DataFrame data (fetch resource data)
    print("2. Testing DataFrame serialization...")
    json_path2 = test_dir / f"dataframe_{datetime.now().strftime('%H%M%S')}.json"
    
    try:
        import pandas as pd
        
        # Create a sample DataFrame
        sample_df = pd.DataFrame({
            'name': ['Dataset A', 'Dataset B', 'Dataset C'],
            'format': ['CSV', 'JSON', 'XML'],
            'size': [1024, 2048, 512]
        })
        
        # Create a response structure similar to fetch_resource_data
        test_response = {
            'success': True,
            'data': sample_df,
            'metadata': {
                'url': 'https://example.com/data.csv',
                'format': 'csv',
                'size': 3456
            }
        }
        
        # Test JSON saving
        from tooling import _save_to_json
        json_result = _save_to_json(test_response, str(json_path2))
        
        if json_result.get('json_saved'):
            print(f"   ✓ DataFrame serialized and saved to: {json_result['json_file_path']}")
            print(f"   ✓ File size: {json_result['json_file_size']} bytes")
            
            # Verify the DataFrame structure is preserved
            with open(json_result['json_file_path'], 'r') as f:
                loaded_data = json.load(f)
            
            df_data = loaded_data.get('data', {})
            if df_data.get('_type') == 'pandas_dataframe':
                print(f"   ✓ DataFrame metadata preserved: shape {df_data['_shape']}, columns {df_data['_columns']}")
            else:
                print("   ✗ DataFrame metadata not found")
        else:
            print(f"   ✗ DataFrame save failed: {json_result.get('json_error', 'Unknown error')}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 3: Test with complex nested data
    print("3. Testing complex data serialization...")
    json_path3 = test_dir / f"complex_{datetime.now().strftime('%H%M%S')}.json"
    
    try:
        complex_data = {
            'success': True,
            'result': {
                'packages': [
                    {'id': 'pkg1', 'title': 'Test Package 1'},
                    {'id': 'pkg2', 'title': 'Test Package 2'}
                ],
                'facets': {'format': {'CSV': 10, 'JSON': 5}},
                'count': 15
            },
            'timestamp': datetime.now(),
            'nested_dict': {
                'level1': {
                    'level2': {
                        'data': [1, 2, 3, 4, 5]
                    }
                }
            }
        }
        
        from tooling import _save_to_json
        json_result = _save_to_json(complex_data, str(json_path3))
        
        if json_result.get('json_saved'):
            print(f"   ✓ Complex data saved to: {json_result['json_file_path']}")
            print(f"   ✓ File size: {json_result['json_file_size']} bytes")
            
            # Check if datetime was handled
            with open(json_result['json_file_path'], 'r') as f:
                loaded_data = json.load(f)
            
            if loaded_data.get('timestamp', {}).get('_type') == 'datetime':
                print("   ✓ Datetime serialization working correctly")
            
            if loaded_data.get('_metadata'):
                print(f"   ✓ Metadata added: saved at {loaded_data['_metadata']['saved_at']}")
                
        else:
            print(f"   ✗ Complex data save failed: {json_result.get('json_error', 'Unknown error')}")
            
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print()
    print("Test Summary:")
    print(f"Files created in: {test_dir.absolute()}")
    
    # List created files
    json_files = list(test_dir.glob("*.json"))
    print(f"JSON files created: {len(json_files)}")
    for file in json_files:
        size = file.stat().st_size
        print(f"  - {file.name} ({size} bytes)")
    
    return len(json_files)


if __name__ == "__main__":
    num_files = asyncio.run(test_json_saving())
    print(f"\nTest completed. {num_files} JSON files created.")
