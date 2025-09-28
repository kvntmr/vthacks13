"""
LangGraph Data Visualization Agent

This agent specializes in data visualization using MCP (Model Context Protocol) 
visualization tools. It connects to a streamable HTTP MCP server that provides 
visualization capabilities and creates interactive charts, graphs, and plots.
"""

import os
import getpass
from typing import Dict, Any, List, Optional
import asyncio
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langfuse.langchain import CallbackHandler

# Initialize Langfuse callback handler
langfuse_handler = CallbackHandler()
config = {"callbacks": [langfuse_handler]}


class VisualizationAgent:
    """
    A LangGraph agent specialized for data visualization using MCP visualization tools.
    Connects to a streamable HTTP MCP server that provides visualization capabilities.
    """
    
    SYSTEM_PROMPT = """
You are a specialized Data Visualization Agent with expertise in creating compelling, 
informative, and interactive visualizations from various data sources.

YOUR SOLE PURPOSE:
- Transform raw data into meaningful visual representations
- Create charts, graphs, plots, and interactive visualizations
- Help users understand data patterns, trends, and insights through visualization
- Recommend the best visualization types for different data types and use cases

VISUALIZATION EXPERTISE:
1. CHART TYPES & SELECTION
   - Bar charts, line graphs, scatter plots, pie charts
   - Histograms, box plots, violin plots for distributions
   - Heatmaps for correlation and matrix data
   - Time series plots for temporal data
   - Geospatial maps for location-based data
   - Multi-panel and dashboard layouts

2. DATA ANALYSIS FOR VISUALIZATION
   - Identify data types (numerical, categorical, temporal, spatial)
   - Detect patterns, trends, outliers, and relationships
   - Recommend appropriate chart types based on data characteristics
   - Suggest data transformations for better visualization

3. INTERACTIVE FEATURES
   - Tooltips and hover information
   - Zooming and panning capabilities
   - Filtering and brushing interactions
   - Multi-dimensional drill-down capabilities
   - Dynamic updates and animations

4. DESIGN PRINCIPLES
   - Clear, readable axes and labels
   - Appropriate color schemes and palettes
   - Proper scaling and proportions
   - Accessibility considerations
   - Mobile-responsive designs

5. VISUALIZATION TOOLS & FORMATS
   - Static images (PNG, SVG, PDF)
   - Interactive web visualizations (HTML/JavaScript)
   - Dashboard layouts and multi-panel displays
   - Export formats for presentations and reports

WORKFLOW APPROACH:
1. UNDERSTAND THE DATA
   - Analyze data structure, types, and quality
   - Identify key variables and relationships
   - Understand the user's visualization goals

2. RECOMMEND VISUALIZATIONS
   - Suggest appropriate chart types
   - Explain reasoning for recommendations
   - Consider multiple visualization options

3. CREATE VISUALIZATIONS
   - Use available MCP visualization tools
   - Apply best practices for clarity and impact
   - Ensure proper formatting and styling

4. ENHANCE & ITERATE
   - Add interactive features when beneficial
   - Optimize for the intended audience
   - Provide alternative views if requested

COMMUNICATION STYLE:
- Focus exclusively on visualization and data presentation
- Ask clarifying questions about visualization preferences
- Explain design choices and visualization benefits
- Provide actionable insights from the visual representations
- Offer suggestions for improving or extending visualizations

IMPORTANT GUIDELINES:
- Always prioritize clarity and accuracy in visualizations
- Choose colors and styles that enhance data comprehension
- Consider the target audience when designing visualizations
- Provide context and explanations for complex visualizations
- Suggest data preparation steps if needed for better visualization

When users provide data or request visualizations:
1. Analyze the data structure and characteristics
2. Recommend the most appropriate visualization types
3. Create clear, informative visualizations using available tools
4. Explain the insights revealed by the visualizations
5. Offer suggestions for additional or alternative views
"""

    def __init__(self, google_api_key: Optional[str] = None, mcp_server_url: str = "http://localhost:1122/mcp"):
        """
        Initialize the Visualization Agent.
        
        Args:
            google_api_key: Google API key for Gemini. If not provided, will prompt for it.
            mcp_server_url: URL of the MCP visualization server
        """
        self.google_api_key = google_api_key or self._get_api_key()
        self.mcp_server_url = mcp_server_url
        self.llm = self._initialize_llm()
        self.mcp_client = None
        self.agent = None
        self._tools_loaded = False
    
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
            temperature=0.3,  # Lower temperature for more consistent visualization recommendations
        )
    
    async def _initialize_mcp_connection(self):
        """Initialize connection to the MCP visualization server."""
        if self.mcp_client is None:
            try:
                # Configure MCP client for streamable HTTP connection
                self.mcp_client = MultiServerMCPClient({
                    "visualization": {
                        "transport": "streamable_http",
                        "url": self.mcp_server_url
                    }
                })
                
                # Get tools from the MCP server
                tools = await self.mcp_client.get_tools()
                
                if not tools:
                    print(f"Warning: No tools received from MCP server at {self.mcp_server_url}")
                    print("Make sure the MCP visualization server is running and accessible.")
                    # Create agent without tools as fallback
                    self.agent = create_react_agent(self.llm, [])
                else:
                    print(f"Successfully connected to MCP server. Loaded {len(tools)} visualization tools.")
                    # Create agent with MCP tools
                    self.agent = create_react_agent(self.llm, tools)
                
                self._tools_loaded = True
                
            except Exception as e:
                print(f"Failed to connect to MCP server at {self.mcp_server_url}: {str(e)}")
                print("Creating agent without MCP tools. Please ensure the MCP server is running.")
                # Create agent without tools as fallback
                self.agent = create_react_agent(self.llm, [])
                self._tools_loaded = True
    
    async def query(self, user_input: str, data_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a user query about data visualization.
        
        Args:
            user_input: The user's visualization request
            data_context: Optional context about the data to be visualized
            
        Returns:
            Dict containing the agent's response and metadata
        """
        try:
            # Initialize MCP connection if not already done
            if not self._tools_loaded:
                await self._initialize_mcp_connection()
            
            # Prepare messages with system prompt
            messages = [
                ("system", self.SYSTEM_PROMPT),
            ]
            
            # Add data context if provided
            if data_context:
                messages.append(("system", f"Data Context: {data_context}"))
            
            # Add user message
            messages.append(("user", user_input))
            
            # Stream the agent's response
            events = self.agent.stream(
                {"messages": messages},
                stream_mode="values",
                config={"callbacks": [langfuse_handler]}
            )
            
            # Collect all messages
            all_messages = []
            for event in events:
                all_messages.extend(event.get("messages", []))
            
            # Get the final response
            final_message = all_messages[-1] if all_messages else None
            
            return {
                "success": True,
                "response": final_message.content if final_message else "No response generated",
                "all_messages": all_messages,
                "message_count": len(all_messages),
                "mcp_connected": self.mcp_client is not None,
                "tools_available": self._tools_loaded
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": f"Error processing visualization query: {str(e)}",
                "mcp_connected": self.mcp_client is not None,
                "tools_available": self._tools_loaded
            }
    
    def query_sync(self, user_input: str, data_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Synchronous wrapper for the query method.
        
        Args:
            user_input: The user's visualization request
            data_context: Optional context about the data to be visualized
            
        Returns:
            Dict containing the agent's response and metadata
        """
        try:
            # Check if we're in an async context
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                # No running loop, we can create one
                return asyncio.run(self.query(user_input, data_context))
            else:
                # We're in an async context, need to handle differently
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(self.query(user_input, data_context))
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": f"Error processing visualization query: {str(e)}"
            }
    
    async def get_available_tools(self) -> List[str]:
        """
        Get list of available visualization tools from the MCP server.
        
        Returns:
            List of tool names available for visualization
        """
        if not self._tools_loaded:
            await self._initialize_mcp_connection()
        
        if self.mcp_client:
            try:
                tools = await self.mcp_client.get_tools()
                return [tool.name for tool in tools] if tools else []
            except Exception as e:
                print(f"Error getting tools: {str(e)}")
                return []
        return []
    
    def interactive_mode(self):
        """
        Start an interactive chat session with the visualization agent.
        """
        print("=== Data Visualization Agent ===")
        print("I specialize in creating beautiful and informative data visualizations.")
        print("Provide me with data or describe what you'd like to visualize, and I'll help you create the perfect chart or graph.")
        print("Type 'quit' or 'exit' to end the session.")
        print("Type 'tools' to see available visualization tools.\n")
        
        while True:
            try:
                user_input = input("\nYou: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'bye']:
                    print("Goodbye! Happy visualizing!")
                    break
                
                if user_input.lower() == 'tools':
                    tools = asyncio.run(self.get_available_tools())
                    if tools:
                        print(f"\nAvailable visualization tools: {', '.join(tools)}")
                    else:
                        print("\nNo MCP visualization tools currently available.")
                        print("Make sure the MCP server is running at", self.mcp_server_url)
                    continue
                
                if not user_input:
                    continue
                
                print("\nVisualization Agent: Creating your visualization...")
                
                # Get response
                result = self.query_sync(user_input)
                
                if result["success"]:
                    print(f"\nVisualization Agent: {result['response']}")
                    if not result.get("mcp_connected", False):
                        print("\nNote: MCP visualization server not connected. Limited functionality available.")
                else:
                    print(f"\nVisualization Agent: Sorry, I encountered an error: {result['error']}")
                    
            except KeyboardInterrupt:
                print("\n\nSession interrupted. Goodbye!")
                break
            except Exception as e:
                print(f"\nUnexpected error: {str(e)}")
                continue


# Convenience functions for direct use
def create_visualization_agent(google_api_key: Optional[str] = None, mcp_server_url: str = "http://localhost:1122/mcp") -> VisualizationAgent:
    """
    Create and return a Visualization Agent instance.
    
    Args:
        google_api_key: Optional Google API key. If not provided, will prompt for it.
        mcp_server_url: URL of the MCP visualization server
        
    Returns:
        VisualizationAgent instance ready for use
    """
    return VisualizationAgent(google_api_key, mcp_server_url)


async def create_visualization(request: str, data_context: Optional[str] = None, google_api_key: Optional[str] = None, mcp_server_url: str = "http://localhost:1122/mcp") -> Dict[str, Any]:
    """
    Quick function to create a visualization without creating an agent instance.
    
    Args:
        request: The visualization request
        data_context: Optional context about the data
        google_api_key: Optional Google API key
        mcp_server_url: URL of the MCP visualization server
        
    Returns:
        Dict containing the agent's response
    """
    agent = VisualizationAgent(google_api_key, mcp_server_url)
    return await agent.query(request, data_context)


def create_visualization_sync(request: str, data_context: Optional[str] = None, google_api_key: Optional[str] = None, mcp_server_url: str = "http://localhost:1122/mcp") -> Dict[str, Any]:
    """
    Synchronous version of create_visualization.
    
    Args:
        request: The visualization request
        data_context: Optional context about the data
        google_api_key: Optional Google API key
        mcp_server_url: URL of the MCP visualization server
        
    Returns:
        Dict containing the agent's response
    """
    agent = VisualizationAgent(google_api_key, mcp_server_url)
    return agent.query_sync(request, data_context)


if __name__ == "__main__":
    # Start interactive mode when run directly
    agent = create_visualization_agent()
    agent.interactive_mode()
