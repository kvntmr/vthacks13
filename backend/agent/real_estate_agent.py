"""
Commercial Real Estate Due Diligence Agent

This agent specializes in fetching and analyzing data from Data.gov to support
commercial real estate due diligence activities. It can search for and retrieve
datasets related to crime statistics, zoning information, construction permits,
water quality, demographics, and other factors that impact real estate decisions.
"""

import os
import getpass
from typing import Dict, Any, List, Optional
import asyncio
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langfuse.langchain import CallbackHandler
langfuse_handler = CallbackHandler()
config={"callbacks": [langfuse_handler]}

# Import all data.gov tools from tooling.py
from tooling import (
    search_packages,
    get_package_details,
    list_groups,
    list_tags,
    fetch_resource_data,
    validate_resource_url,
    get_package_resources,
    build_search_query,
    get_catalog_info,
    # Tool collection for easy access
    DATA_GOV_TOOLS
)


class RealEstateAgent:
    """
    A LangChain agent specialized for commercial real estate due diligence
    using Data.gov datasets.
    """
    
    SYSTEM_PROMPT = """
You are a specialized Commercial Real Estate Due Diligence Agent with expertise in analyzing
government data from Data.gov to support real estate investment and development decisions.

YOUR ROLE:
- Help commercial real estate professionals assess properties and markets
- Find and analyze relevant government datasets for due diligence
- Provide data-driven insights on factors affecting real estate value and risk
- ALWAYS save the results to a JSON file for future reference and analysis.

KEY FOCUS AREAS:
1. CRIME & SAFETY DATA
   - Crime statistics by location/zip code
   - Police incident reports
   - Public safety metrics
   - Emergency response data

2. ZONING & PLANNING
   - Zoning classifications and restrictions
   - Land use regulations
   - Development permits and approvals
   - Planning commission records

3. CONSTRUCTION & PERMITS
   - Building permits issued
   - Construction activity trends
   - Code violations and inspections
   - Infrastructure projects

4. ENVIRONMENTAL FACTORS
   - Water quality reports
   - Air quality measurements
   - Soil contamination data
   - Flood zone information
   - Environmental impact assessments

5. DEMOGRAPHICS & ECONOMICS
   - Population demographics
   - Income and employment data
   - Business licenses and activity
   - Tax assessment records

6. TRANSPORTATION & INFRASTRUCTURE
   - Traffic patterns and counts
   - Public transit accessibility
   - Road conditions and maintenance
   - Airport and transportation hubs

7. UTILITIES & SERVICES
   - Utility service areas
   - Internet/broadband availability
   - Public services coverage
   - Emergency services access

SEARCH STRATEGIES:
- Use location-specific searches (city, county, state, zip code)
- Look for recent data (prioritize datasets updated within last 2-3 years)
- Cross-reference multiple datasets for comprehensive analysis
- Focus on CSV, JSON, and structured data formats when possible

ANALYSIS APPROACH:
1. Start with broad searches to understand available data
2. Identify relevant organizations (EPA, DOT, HUD, Census, etc.)
3. Drill down to specific datasets with detailed analysis
4. Validate data quality and recency
5. Provide actionable insights with data limitations clearly stated

COMMUNICATION STYLE:
- Be professional and analytical
- Provide specific dataset recommendations with URLs
- Explain data limitations and potential biases
- Offer practical insights for real estate decision-making
- Include data source citations and last update dates

When users ask about properties or areas, always:
1. Search for relevant datasets using multiple search terms
2. Validate data sources and currency
3. Download and analyze small datasets when helpful
4. Provide summary insights with supporting data
5. Recommend additional research if needed

Remember: You're helping make informed real estate decisions that involve significant
financial investments. Accuracy, recency, and comprehensive analysis are critical.
"""

    def __init__(self, google_api_key: Optional[str] = None):
        """
        Initialize the Real Estate Agent.
        
        Args:
            google_api_key: Google API key for Gemini. If not provided, will prompt for it.
        """
        self.google_api_key = google_api_key or self._get_api_key()
        self.llm = self._initialize_llm()
        self.agent = self._create_agent()
    
    def _get_api_key(self) -> str:
        """Get Google API key from environment or user input."""
        if not os.environ.get("GOOGLE_API_KEY"):
            os.environ["GOOGLE_API_KEY"] = getpass.getpass("Enter API key for Google Gemini: ")
        return os.environ["GOOGLE_API_KEY"]
    
    def _initialize_llm(self):
        """Initialize the Gemini chat model."""
        return init_chat_model(
            "gemini-2.5-pro", 
            model_provider="google_genai",
            temperature=0.7,  # Slightly creative but mostly factual
        )
    
    def _create_agent(self):
        """Create the ReAct agent with all data.gov tools."""
        # Create agent with tools - system prompt will be handled in query method
        agent = create_react_agent(self.llm, DATA_GOV_TOOLS)
        return agent
    
    async def query(self, user_input: str) -> Dict[str, Any]:
        """
        Process a user query about real estate due diligence.
        
        Args:
            user_input: The user's question or request
            
        Returns:
            Dict containing the agent's response and metadata
        """
        try:
            # Include system prompt and user message
            messages = [
                ("system", self.SYSTEM_PROMPT),
                ("user", user_input)
            ]
            
            # Stream the agent's response (async)
            events = self.agent.astream(
                {"messages": messages},
                stream_mode="values",
                config={"callbacks": [langfuse_handler]}
            )
            
            # Collect all messages
            all_messages = []
            async for event in events:
                all_messages.extend(event.get("messages", []))
            
            # Get the final response
            final_message = all_messages[-1] if all_messages else None
            
            return {
                "success": True,
                "response": final_message.content if final_message else "No response generated",
                "all_messages": all_messages,
                "message_count": len(all_messages)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": f"Error processing query: {str(e)}"
            }
    
    def query_sync(self, user_input: str) -> Dict[str, Any]:
        """
        Synchronous wrapper for the query method.
        
        Args:
            user_input: The user's question or request
            
        Returns:
            Dict containing the agent's response and metadata
        """
        try:
            # Check if we're in an async context
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                # No running loop, we can create one
                return asyncio.run(self.query(user_input))
            else:
                # We're in an async context, need to handle differently
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(self.query(user_input))
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": f"Error processing query: {str(e)}"
            }
    
    def interactive_mode(self):
        """
        Start an interactive chat session with the agent.
        """
        print("=== Commercial Real Estate Due Diligence Agent ===")
        print("I can help you find and analyze government data for real estate research.")
        print("Ask me about crime data, zoning, permits, demographics, or any location-specific data.")
        print("Type 'quit' or 'exit' to end the session.\n")
        
        while True:
            try:
                user_input = input("\nYou: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'bye']:
                    print("Goodbye! Good luck with your real estate research.")
                    break
                
                if not user_input:
                    continue
                
                print("\nAgent: Processing your query...")
                
                # Get response
                result = self.query_sync(user_input)
                
                if result["success"]:
                    print(f"\nAgent: {result['response']}")
                else:
                    print(f"\nAgent: Sorry, I encountered an error: {result['error']}")
                    
            except KeyboardInterrupt:
                print("\n\nSession interrupted. Goodbye!")
                break
            except Exception as e:
                print(f"\nUnexpected error: {str(e)}")
                continue


# Convenience functions for direct use
def create_real_estate_agent(google_api_key: Optional[str] = None) -> RealEstateAgent:
    """
    Create and return a Real Estate Agent instance.
    
    Args:
        google_api_key: Optional Google API key. If not provided, will prompt for it.
        
    Returns:
        RealEstateAgent instance ready for use
    """
    return RealEstateAgent(google_api_key)


async def query_real_estate_data(question: str, google_api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Quick function to query real estate data without creating an agent instance.
    
    Args:
        question: The question to ask the agent
        google_api_key: Optional Google API key
        
    Returns:
        Dict containing the agent's response
    """
    agent = RealEstateAgent(google_api_key)
    return await agent.query(question)


def query_real_estate_data_sync(question: str, google_api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Synchronous version of query_real_estate_data.
    
    Args:
        question: The question to ask the agent
        google_api_key: Optional Google API key
        
    Returns:
        Dict containing the agent's response
    """
    agent = RealEstateAgent(google_api_key)
    return agent.query_sync(question)


if __name__ == "__main__":
    # Start interactive mode when run directly
    agent = create_real_estate_agent()
    agent.interactive_mode()
