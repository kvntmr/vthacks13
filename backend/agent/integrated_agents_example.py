"""
Integrated Agents Example

This module demonstrates how to use both the Real Estate Agent and the Visualization Agent
together to analyze real estate data and create meaningful visualizations.
"""

import asyncio
from typing import Dict, Any, Optional
from real_estate_agent import create_real_estate_agent
from visualization_agent import create_visualization_agent


class IntegratedRealEstateAnalysis:
    """
    Integrated system that combines real estate data analysis with visualization capabilities.
    """
    
    def __init__(self, google_api_key: Optional[str] = None, mcp_server_url: str = "http://localhost:1122/mcp"):
        """
        Initialize the integrated analysis system.
        
        Args:
            google_api_key: Google API key for both agents
            mcp_server_url: URL of the MCP visualization server
        """
        self.real_estate_agent = create_real_estate_agent(google_api_key)
        self.visualization_agent = create_visualization_agent(google_api_key, mcp_server_url)
    
    async def analyze_and_visualize(self, location: str, analysis_focus: str = "comprehensive") -> Dict[str, Any]:
        """
        Perform comprehensive real estate analysis and create visualizations.
        
        Args:
            location: Location to analyze (city, county, zip code, etc.)
            analysis_focus: Focus area (crime, demographics, permits, etc., or 'comprehensive')
            
        Returns:
            Dict containing both analysis results and visualization outputs
        """
        results = {
            "location": location,
            "analysis_focus": analysis_focus,
            "data_analysis": None,
            "visualizations": None,
            "success": True,
            "errors": []
        }
        
        try:
            # Step 1: Gather and analyze real estate data
            print(f"🔍 Analyzing real estate data for {location}...")
            
            if analysis_focus == "comprehensive":
                query = f"""
                Please conduct a comprehensive real estate due diligence analysis for {location}.
                Focus on gathering data from multiple sources including:
                1. Crime and safety statistics
                2. Demographics and economic indicators
                3. Zoning and development information
                4. Environmental factors
                5. Transportation and infrastructure
                
                For each dataset you find, please save it to a file so we can use it for visualization.
                Summarize the key findings and highlight any significant trends or concerns.
                """
            else:
                query = f"""
                Please analyze {analysis_focus} data for {location}.
                Find relevant datasets, save them to files, and provide analysis of key trends and insights.
                Focus on data that would be relevant for real estate investment decisions.
                """
            
            # Get real estate analysis
            analysis_result = await self.real_estate_agent.query(query)
            results["data_analysis"] = analysis_result
            
            if not analysis_result.get("success", True):
                results["errors"].append(f"Data analysis failed: {analysis_result.get('error', 'Unknown error')}")
            
            # Step 2: Create visualizations based on the data
            print("📊 Creating visualizations from the analyzed data...")
            
            # Extract data context from the analysis
            data_context = f"""
            Real estate analysis results for {location}:
            {analysis_result.get('response', 'No analysis available')}
            
            Focus area: {analysis_focus}
            """
            
            visualization_query = f"""
            Based on the real estate analysis data for {location}, please create appropriate visualizations.
            
            The analysis focused on: {analysis_focus}
            
            Please:
            1. Identify the key metrics and data points from the analysis
            2. Recommend the most appropriate visualization types for this real estate data
            3. Create clear, informative charts that would help real estate professionals make decisions
            4. Focus on visualizations that highlight trends, comparisons, and risk factors
            5. If the data includes geographic information, consider map-based visualizations
            6. Create dashboard-style layouts if multiple metrics are available
            
            Priority visualization types for real estate analysis:
            - Time series charts for trends over time
            - Comparative bar charts for different areas or metrics
            - Heatmaps for geographic or correlation data
            - Scatter plots for relationship analysis
            - Distribution charts for statistical analysis
            """
            
            # Get visualization results
            viz_result = await self.visualization_agent.query(visualization_query, data_context)
            results["visualizations"] = viz_result
            
            if not viz_result.get("success", True):
                results["errors"].append(f"Visualization failed: {viz_result.get('error', 'Unknown error')}")
            
            # Overall success check
            if results["errors"]:
                results["success"] = False
            
            print("✅ Analysis and visualization complete!")
            
        except Exception as e:
            results["success"] = False
            results["errors"].append(f"Integration error: {str(e)}")
            print(f"❌ Error during analysis: {str(e)}")
        
        return results
    
    async def quick_crime_analysis(self, location: str) -> Dict[str, Any]:
        """
        Quick analysis focused specifically on crime data with visualizations.
        
        Args:
            location: Location to analyze for crime data
            
        Returns:
            Dict containing crime analysis and visualizations
        """
        return await self.analyze_and_visualize(location, "crime and safety")
    
    async def demographic_market_analysis(self, location: str) -> Dict[str, Any]:
        """
        Analysis focused on demographics and market indicators with visualizations.
        
        Args:
            location: Location to analyze for market data
            
        Returns:
            Dict containing demographic analysis and visualizations
        """
        return await self.analyze_and_visualize(location, "demographics and economic indicators")
    
    def print_results(self, results: Dict[str, Any]):
        """
        Pretty print the analysis and visualization results.
        
        Args:
            results: Results dictionary from analyze_and_visualize
        """
        print("\n" + "="*80)
        print(f"INTEGRATED REAL ESTATE ANALYSIS RESULTS")
        print(f"Location: {results['location']}")
        print(f"Focus: {results['analysis_focus']}")
        print(f"Success: {'✅' if results['success'] else '❌'}")
        print("="*80)
        
        if results["errors"]:
            print("\n⚠️  ERRORS:")
            for error in results["errors"]:
                print(f"   - {error}")
        
        if results["data_analysis"]:
            print("\n🔍 DATA ANALYSIS RESULTS:")
            print("-" * 40)
            analysis = results["data_analysis"]
            if analysis.get("success", True):
                print(analysis.get("response", "No response available"))
                if analysis.get("message_count", 0) > 0:
                    print(f"\nProcessed {analysis['message_count']} messages during analysis")
            else:
                print(f"Analysis failed: {analysis.get('error', 'Unknown error')}")
        
        if results["visualizations"]:
            print("\n📊 VISUALIZATION RESULTS:")
            print("-" * 40)
            viz = results["visualizations"]
            if viz.get("success", True):
                print(viz.get("response", "No response available"))
                print(f"\nMCP Server Connected: {'✅' if viz.get('mcp_connected', False) else '❌'}")
                print(f"Tools Available: {'✅' if viz.get('tools_available', False) else '❌'}")
                if viz.get("message_count", 0) > 0:
                    print(f"Processed {viz['message_count']} messages during visualization")
            else:
                print(f"Visualization failed: {viz.get('error', 'Unknown error')}")
        
        print("\n" + "="*80)


async def main():
    """
    Example usage of the integrated real estate analysis system.
    """
    print("🏢 Integrated Real Estate Analysis System")
    print("This system combines data analysis with visualization capabilities.\n")
    
    # Create the integrated system
    system = IntegratedRealEstateAnalysis()
    
    # Example 1: Comprehensive analysis
    print("Example 1: Comprehensive Analysis")
    results1 = await system.analyze_and_visualize("Austin, TX", "comprehensive")
    system.print_results(results1)
    
    # Example 2: Crime-focused analysis
    print("\n" + "="*80)
    print("Example 2: Crime Analysis")
    results2 = await system.quick_crime_analysis("San Francisco, CA")
    system.print_results(results2)
    
    # Example 3: Market demographics
    print("\n" + "="*80) 
    print("Example 3: Market Demographics")
    results3 = await system.demographic_market_analysis("Miami, FL")
    system.print_results(results3)


def interactive_mode():
    """
    Interactive mode for the integrated system.
    """
    print("🏢 Interactive Real Estate Analysis & Visualization")
    print("Choose your analysis type and location for comprehensive insights.\n")
    
    system = IntegratedRealEstateAnalysis()
    
    while True:
        try:
            print("\nAvailable analysis types:")
            print("1. Comprehensive analysis")
            print("2. Crime and safety analysis")
            print("3. Demographics and market analysis")
            print("4. Custom analysis")
            print("5. Quit")
            
            choice = input("\nSelect analysis type (1-5): ").strip()
            
            if choice == "5":
                print("Goodbye!")
                break
            
            if choice not in ["1", "2", "3", "4"]:
                print("Invalid choice. Please select 1-5.")
                continue
            
            location = input("Enter location (city, county, zip code): ").strip()
            if not location:
                print("Location is required.")
                continue
            
            if choice == "1":
                print(f"\n🔄 Starting comprehensive analysis for {location}...")
                results = asyncio.run(system.analyze_and_visualize(location, "comprehensive"))
            elif choice == "2":
                print(f"\n🔄 Starting crime analysis for {location}...")
                results = asyncio.run(system.quick_crime_analysis(location))
            elif choice == "3":
                print(f"\n🔄 Starting demographic analysis for {location}...")
                results = asyncio.run(system.demographic_market_analysis(location))
            elif choice == "4":
                focus = input("Enter custom analysis focus: ").strip()
                if not focus:
                    focus = "general"
                print(f"\n🔄 Starting custom analysis for {location}...")
                results = asyncio.run(system.analyze_and_visualize(location, focus))
            
            system.print_results(results)
            
        except KeyboardInterrupt:
            print("\n\nSession interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\nError: {str(e)}")
            continue


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_mode()
    else:
        asyncio.run(main())
