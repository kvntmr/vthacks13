"""
Simple Real Estate Screener
Generates summaries from property data using AI
"""

import json
from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

class SimpleScreener:
    """Simple screener that generates property summaries"""
    
    def __init__(self):
        """Initialize the screener with AI model"""
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.3,
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
    
    async def screen_property(self, text: str) -> str:
        """
        Generate a comprehensive property summary from raw text
        
        Args:
            text: Raw text from PowerPoint or other source
            
        Returns:
            String containing the property summary
        """
        return await self.screen_properties([{"text": text, "source": "single_file"}])
    
    async def screen_properties(self, text_inputs: List[Dict[str, str]]) -> str:
        """
        Generate a comprehensive property summary from multiple text sources
        
        Args:
            text_inputs: List of dictionaries containing 'text' and 'source' keys
            
        Returns:
            String containing the comprehensive property summary
        """
        try:
            # Format the input for the AI
            formatted_inputs = []
            for i, input_data in enumerate(text_inputs, 1):
                text = input_data.get("text", "")
                source = input_data.get("source", f"file_{i}")
                formatted_inputs.append(f"--- SOURCE {i}: {source} ---\n{text}\n")
            
            combined_text = "\n".join(formatted_inputs)
            
            # Create the prompt template
            prompt = ChatPromptTemplate.from_template("""
You are a real estate investment analyst speaking directly to a client. Analyze the following property information from multiple sources and create a comprehensive investment summary.

IMPORTANT: The information below comes from {num_sources} different files/sources. Please analyze ALL sources and take everything into account when creating your summary. Differentiate between the sources when relevant, but synthesize the information into a cohesive analysis.

Property Information from Multiple Sources:
{text}

Write your analysis as if you're presenting directly to the client. Use a conversational tone and address them directly (e.g., "Based on my analysis..." or "I recommend...").

Structure your response with clear headers and follow these formatting guidelines:

## EXECUTIVE SUMMARY
Write this section in paragraph form, explaining the investment opportunity in a conversational way. Include:
- Your overall assessment of the investment based on ALL available information
- Key highlights that make this attractive (synthesize from all sources)
- Main risks and opportunities (consider all data points)
- Your recommendation (BUY/HOLD/AVOID) with clear reasoning based on comprehensive analysis

## DEAL OVERVIEW
Use a mix of paragraphs and bullet points:
- Start with a paragraph explaining the deal structure and key players (from all sources)
- Use bullet points for specific financial metrics, lease terms, and financing details
- Keep data points concise and easy to scan
- Note any discrepancies or additional information found across different sources

## ASSET & TENANCY
Structure this section with:
- Paragraphs for property description and market positioning (synthesize from all sources)
- Bullet points for specific specifications, tenant details, and operational considerations
- Clear explanations of how the asset fits into the broader market
- Reference different sources when they provide unique insights

Guidelines:
- Use bullet points for lists of data, metrics, and specific details
- Use paragraphs for explanations, analysis, and narrative content
- Make headers clear and prominent
- Keep the tone professional but conversational
- Address the client directly throughout the analysis
- Synthesize information from all sources rather than just listing them separately
- If sources contain conflicting information, acknowledge this and provide your assessment
""")
            
            # Create the chain and get response
            chain = prompt | self.llm
            result = chain.invoke({
                "text": combined_text,
                "num_sources": len(text_inputs)
            })
            
            return result.content
            
        except Exception as e:
            return f"Error generating property summary: {str(e)}"
