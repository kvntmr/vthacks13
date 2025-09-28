"""
Test Script for LangGraph Visualization Agent

This script tests the visualization agent's functionality including:
- Connection to MCP server
- Tool availability
- Visualization generation
- Integration with real estate data
"""

import asyncio
import json
from typing import Dict, Any
from visualization_agent import create_visualization_agent
from integrated_agents_example import IntegratedRealEstateAnalysis


async def test_mcp_connection():
    """Test basic MCP server connection."""
    print("🔗 Testing MCP Server Connection...")
    
    agent = create_visualization_agent()
    
    # Test connection and get available tools
    try:
        tools = await agent.get_available_tools()
        print(f"✅ MCP Connection successful!")
        print(f"📋 Available tools: {tools}")
        
        if not tools:
            print("⚠️  No tools available from MCP server")
            print("   Make sure your MCP visualization server is running at http://localhost:1122/mcp")
        
        return True, tools
        
    except Exception as e:
        print(f"❌ MCP Connection failed: {str(e)}")
        print("   Ensure the MCP server is running and accessible")
        return False, []


async def test_basic_visualization():
    """Test basic visualization functionality."""
    print("\n📊 Testing Basic Visualization...")
    
    agent = create_visualization_agent()
    
    test_request = """
    Create a simple bar chart showing the following data:
    - Category A: 25
    - Category B: 35
    - Category C: 20
    - Category D: 40
    
    Make it visually appealing with appropriate colors and labels.
    """
    
    try:
        result = await agent.query(test_request)
        
        if result.get("success", False):
            print("✅ Basic visualization test successful!")
            print(f"📝 Response: {result.get('response', '')[:200]}...")
            print(f"🔧 MCP Connected: {result.get('mcp_connected', False)}")
            print(f"🛠️  Tools Available: {result.get('tools_available', False)}")
        else:
            print(f"❌ Visualization failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Basic visualization test failed: {str(e)}")
        return {"success": False, "error": str(e)}


async def test_data_context_visualization():
    """Test visualization with data context."""
    print("\n📈 Testing Visualization with Data Context...")
    
    agent = create_visualization_agent()
    
    # Sample real estate data context
    data_context = """
    Real Estate Analysis Data for Austin, TX:
    - Crime Rate: 2.8 per 1000 residents (down 5% from last year)
    - Average Home Price: $485,000 (up 12% from last year)
    - Population Growth: 3.2% annually
    - New Construction Permits: 1,250 this quarter
    - School Ratings: Average 8.2/10
    - Walk Score: 42 (car-dependent)
    """
    
    visualization_request = """
    Based on the real estate data provided, create appropriate visualizations that would help
    real estate investors understand the market. Consider:
    1. A time series chart showing price trends
    2. A comparative bar chart for different metrics
    3. A simple dashboard layout if possible
    
    Focus on making the data actionable for investment decisions.
    """
    
    try:
        result = await agent.query(visualization_request, data_context)
        
        if result.get("success", False):
            print("✅ Data context visualization test successful!")
            print(f"📝 Response: {result.get('response', '')[:300]}...")
        else:
            print(f"❌ Data context visualization failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Data context visualization test failed: {str(e)}")
        return {"success": False, "error": str(e)}


async def test_integrated_analysis():
    """Test the integrated analysis system."""
    print("\n🏢 Testing Integrated Analysis System...")
    
    try:
        system = IntegratedRealEstateAnalysis()
        
        # Test with a simple location
        result = await system.analyze_and_visualize(
            location="Seattle, WA",
            analysis_focus="crime and safety"
        )
        
        if result.get("success", False):
            print("✅ Integrated analysis test successful!")
            print(f"📍 Location: {result.get('location')}")
            print(f"🎯 Focus: {result.get('analysis_focus')}")
            
            # Check data analysis
            data_analysis = result.get("data_analysis")
            if data_analysis:
                print(f"📊 Data analysis successful: {data_analysis.get('success', False)}")
            
            # Check visualizations
            visualizations = result.get("visualizations")
            if visualizations:
                print(f"📈 Visualizations successful: {visualizations.get('success', False)}")
                print(f"🔗 MCP Connected: {visualizations.get('mcp_connected', False)}")
            
            errors = result.get("errors", [])
            if errors:
                print(f"⚠️  Errors encountered: {errors}")
        else:
            print(f"❌ Integrated analysis failed")
            errors = result.get("errors", [])
            for error in errors:
                print(f"   - {error}")
        
        return result
        
    except Exception as e:
        print(f"❌ Integrated analysis test failed: {str(e)}")
        return {"success": False, "error": str(e)}


async def test_error_handling():
    """Test error handling scenarios."""
    print("\n🚨 Testing Error Handling...")
    
    agent = create_visualization_agent()
    
    # Test with invalid/malformed request
    invalid_request = "This is not a valid visualization request with no clear data or chart type specified."
    
    try:
        result = await agent.query(invalid_request)
        
        # Even if the request is vague, the agent should handle it gracefully
        print(f"📝 Handled vague request: {result.get('success', False)}")
        
        if not result.get("success", False):
            print(f"⚠️  Expected failure for vague request: {result.get('error', 'No error message')}")
        else:
            print(f"✅ Agent provided helpful guidance for vague request")
        
        return result
        
    except Exception as e:
        print(f"❌ Error handling test failed: {str(e)}")
        return {"success": False, "error": str(e)}


def save_test_results(results: Dict[str, Any]):
    """Save test results to a JSON file."""
    try:
        with open("test_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n💾 Test results saved to test_results.json")
    except Exception as e:
        print(f"\n❌ Failed to save test results: {str(e)}")


async def run_all_tests():
    """Run all tests and collect results."""
    print("🧪 Starting Visualization Agent Test Suite")
    print("=" * 60)
    
    test_results = {
        "timestamp": asyncio.get_event_loop().time(),
        "tests": {}
    }
    
    # Test 1: MCP Connection
    mcp_success, tools = await test_mcp_connection()
    test_results["tests"]["mcp_connection"] = {
        "success": mcp_success,
        "tools": tools
    }
    
    # Test 2: Basic Visualization
    basic_result = await test_basic_visualization()
    test_results["tests"]["basic_visualization"] = basic_result
    
    # Test 3: Data Context Visualization
    context_result = await test_data_context_visualization()
    test_results["tests"]["data_context_visualization"] = context_result
    
    # Test 4: Integrated Analysis
    integrated_result = await test_integrated_analysis()
    test_results["tests"]["integrated_analysis"] = integrated_result
    
    # Test 5: Error Handling
    error_result = await test_error_handling()
    test_results["tests"]["error_handling"] = error_result
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(test_results["tests"])
    successful_tests = sum(1 for test in test_results["tests"].values() 
                          if test.get("success", False))
    
    print(f"Total Tests: {total_tests}")
    print(f"Successful: {successful_tests}")
    print(f"Failed: {total_tests - successful_tests}")
    print(f"Success Rate: {(successful_tests / total_tests * 100):.1f}%")
    
    # Detailed results
    for test_name, result in test_results["tests"].items():
        status = "✅ PASS" if result.get("success", False) else "❌ FAIL"
        print(f"  {test_name}: {status}")
    
    # MCP-specific status
    mcp_connected = test_results["tests"]["mcp_connection"]["success"]
    if mcp_connected:
        print(f"\n🔗 MCP Server Status: ✅ Connected")
        tools_count = len(test_results["tests"]["mcp_connection"]["tools"])
        print(f"🛠️  Available Tools: {tools_count}")
    else:
        print(f"\n🔗 MCP Server Status: ❌ Not Connected")
        print("   Please ensure the MCP visualization server is running at http://localhost:1122/mcp")
    
    # Save results
    save_test_results(test_results)
    
    print("\n🏁 Test suite complete!")
    
    return test_results


def interactive_test():
    """Interactive test mode for manual testing."""
    print("🎮 Interactive Visualization Agent Test Mode")
    print("=" * 50)
    
    agent = create_visualization_agent()
    
    print("Commands:")
    print("  'test' - Run basic tests")
    print("  'tools' - Show available tools")
    print("  'quit' - Exit")
    print("  Or enter a visualization request\n")
    
    while True:
        try:
            user_input = input("Test> ").strip()
            
            if user_input.lower() in ['quit', 'exit']:
                print("Goodbye!")
                break
            
            if user_input.lower() == 'test':
                print("Running basic tests...")
                asyncio.run(run_all_tests())
                continue
            
            if user_input.lower() == 'tools':
                print("Getting available tools...")
                tools = asyncio.run(agent.get_available_tools())
                if tools:
                    print(f"Available tools: {', '.join(tools)}")
                else:
                    print("No tools available or MCP server not connected")
                continue
            
            if not user_input:
                continue
            
            print("Processing visualization request...")
            result = asyncio.run(agent.query(user_input))
            
            if result.get("success", False):
                print(f"✅ Success: {result.get('response', '')}")
                print(f"MCP Connected: {result.get('mcp_connected', False)}")
            else:
                print(f"❌ Failed: {result.get('error', 'Unknown error')}")
            
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {str(e)}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_test()
    else:
        asyncio.run(run_all_tests())
