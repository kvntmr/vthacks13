"""
Usage Examples for Commercial Real Estate Due Diligence Agent

This script demonstrates various ways to use the agent for real estate research.
"""

import asyncio
import os
from real_estate_agent import (
    create_real_estate_agent, 
    query_real_estate_data_sync,
    query_real_estate_data
)


async def example_comprehensive_property_analysis():
    """
    Example: Comprehensive analysis for a property in Austin, Texas
    """
    print("=" * 60)
    print("EXAMPLE: Comprehensive Property Analysis - Austin, TX")
    print("=" * 60)
    
    # Create agent
    agent = create_real_estate_agent()
    
    # Series of queries for comprehensive due diligence
    queries = [
        "Find recent crime statistics and safety data for Austin, Texas, particularly downtown area",
        "What zoning information and land use regulations are available for Austin, Texas?",
        "Search for construction permits and building activity data in Austin, Texas from the last 2 years",
        "Get environmental data for Austin, Texas including water quality and air quality reports",
        "Find demographic and economic data for Austin metro area including population growth trends",
        "Look for transportation and infrastructure data for Austin including traffic patterns and public transit"
    ]
    
    print(f"Running {len(queries)} comprehensive queries...\n")
    
    for i, query in enumerate(queries, 1):
        print(f"Query {i}: {query}")
        print("-" * 40)
        
        try:
            result = await agent.query(query)
            if result["success"]:
                print("Response:")
                print(result["response"][:500] + "..." if len(result["response"]) > 500 else result["response"])
            else:
                print(f"Error: {result['error']}")
        except Exception as e:
            print(f"Exception: {e}")
        
        print("\n" + "="*60 + "\n")


def example_quick_queries():
    """
    Example: Quick single queries for specific data needs
    """
    print("EXAMPLE: Quick Queries for Specific Data")
    print("=" * 40)
    
    quick_queries = [
        "Find crime data for downtown Seattle",
        "Get building permits for Miami in 2023",
        "Search for flood zone data in Houston",
        "Find demographic data for Denver metro area",
        "Get air quality data for Los Angeles"
    ]
    
    for query in quick_queries:
        print(f"\nQuery: {query}")
        print("-" * 30)
        
        try:
            result = query_real_estate_data_sync(query)
            if result["success"]:
                # Show first 200 characters of response
                response_preview = result["response"][:200] + "..." if len(result["response"]) > 200 else result["response"]
                print(f"Success: {response_preview}")
            else:
                print(f"Error: {result['error']}")
        except Exception as e:
            print(f"Exception: {e}")


def example_interactive_session():
    """
    Example: Interactive session with the agent
    """
    print("EXAMPLE: Interactive Session")
    print("=" * 30)
    print("This will start an interactive chat with the agent.")
    print("You can ask questions about real estate data and get responses.")
    print("Type 'demo' to see a demonstration or 'skip' to skip this example.")
    
    choice = input("\nStart interactive session? (demo/skip/yes): ").strip().lower()
    
    if choice == 'demo':
        # Simulate an interactive session with predefined queries
        demo_conversation = [
            "What datasets are available for crime analysis in major cities?",
            "How can I find zoning information for a specific address?",
            "What environmental factors should I consider for a waterfront property?",
            "Find recent construction activity data for the San Francisco Bay Area"
        ]
        
        agent = create_real_estate_agent()
        
        print("\n--- DEMO CONVERSATION ---")
        for user_input in demo_conversation:
            print(f"\nUser: {user_input}")
            result = agent.query_sync(user_input)
            if result["success"]:
                response_preview = result["response"][:300] + "..." if len(result["response"]) > 300 else result["response"]
                print(f"Agent: {response_preview}")
            else:
                print(f"Agent: Error - {result['error']}")
        
    elif choice == 'yes':
        # Start actual interactive session
        agent = create_real_estate_agent()
        agent.interactive_mode()
    else:
        print("Skipping interactive session.")


def example_batch_analysis():
    """
    Example: Batch analysis for multiple properties/locations
    """
    print("EXAMPLE: Batch Analysis for Multiple Locations")
    print("=" * 50)
    
    locations = [
        "Austin, Texas",
        "Denver, Colorado", 
        "Portland, Oregon",
        "Nashville, Tennessee"
    ]
    
    analysis_types = [
        "crime and safety statistics",
        "zoning and development regulations",
        "environmental quality data"
    ]
    
    print(f"Analyzing {len(locations)} locations for {len(analysis_types)} data types...\n")
    
    for location in locations:
        print(f"=== ANALYSIS FOR {location.upper()} ===")
        
        for analysis_type in analysis_types:
            query = f"Find {analysis_type} for {location}"
            print(f"\nQuery: {query}")
            
            try:
                result = query_real_estate_data_sync(query)
                if result["success"]:
                    # Extract key information from response
                    response = result["response"]
                    # Simple summary - first sentence or first 150 characters
                    summary = response.split('.')[0] + '.' if '.' in response else response[:150] + '...'
                    print(f"Summary: {summary}")
                else:
                    print(f"Error: {result['error']}")
            except Exception as e:
                print(f"Exception: {e}")
        
        print("-" * 50)


def example_data_source_exploration():
    """
    Example: Exploring available data sources and organizations
    """
    print("EXAMPLE: Data Source Exploration")
    print("=" * 35)
    
    exploration_queries = [
        "What organizations publish real estate-related data on Data.gov?",
        "Find datasets related to housing and urban development",
        "Search for EPA environmental data that affects real estate",
        "What transportation data is available from DOT?",
        "Find Census Bureau demographic datasets for real estate analysis"
    ]
    
    print("Exploring available data sources...\n")
    
    for i, query in enumerate(exploration_queries, 1):
        print(f"{i}. {query}")
        
        try:
            result = query_real_estate_data_sync(query)
            if result["success"]:
                # Show summary
                lines = result["response"].split('\n')[:3]  # First 3 lines
                summary = '\n'.join(lines)
                print(f"   → {summary}")
            else:
                print(f"   → Error: {result['error']}")
        except Exception as e:
            print(f"   → Exception: {e}")
        
        print()


def main():
    """
    Main function to run all examples
    """
    print("🏢 COMMERCIAL REAL ESTATE DUE DILIGENCE AGENT")
    print("📊 USAGE EXAMPLES")
    print("=" * 60)
    
    # Check for API key
    if not os.environ.get("GOOGLE_API_KEY"):
        print("⚠️  WARNING: No GOOGLE_API_KEY environment variable found.")
        print("   Some examples may not work without a valid API key.")
        print("   Set your API key: export GOOGLE_API_KEY='your_key_here'")
        print()
    
    examples = [
        ("1. Quick Queries", example_quick_queries),
        ("2. Data Source Exploration", example_data_source_exploration),
        ("3. Batch Analysis", example_batch_analysis),
        ("4. Interactive Session", example_interactive_session),
        ("5. Comprehensive Analysis", lambda: asyncio.run(example_comprehensive_property_analysis()))
    ]
    
    print("Available examples:")
    for name, _ in examples:
        print(f"  {name}")
    
    choice = input("\nWhich example would you like to run? (1-5, 'all', or 'quit'): ").strip()
    
    if choice.lower() == 'quit':
        print("Goodbye!")
        return
    
    if choice.lower() == 'all':
        for name, func in examples:
            print(f"\n{'='*60}")
            print(f"RUNNING: {name}")
            print(f"{'='*60}")
            try:
                func()
            except Exception as e:
                print(f"Error running {name}: {e}")
            
            input("\nPress Enter to continue to next example...")
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(examples):
                name, func = examples[idx]
                print(f"\nRunning: {name}")
                print("="*40)
                func()
            else:
                print("Invalid choice.")
        except ValueError:
            print("Invalid choice. Please enter a number 1-5.")


if __name__ == "__main__":
    main()
