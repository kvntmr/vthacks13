"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Loader2, 
  User, 
  Bot, 
  Search,
  Building2,
  BarChart3,
  MapPin,
  TrendingUp,
  AlertCircle,
  PieChart
} from "lucide-react";
import { cn, generateUUID } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  backendAPI, 
  type ResearchQueryRequest, 
  type ResearchQueryResponse,
  type IntegratedAnalysisRequest,
  type IntegratedAnalysisResponse,
  type VisualizationRequest,
  type VisualizationResponse
} from "@/lib/api/backend";

// Types for the research chat
interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  analysis_type?: string;
  location?: string;
  images?: string[];
  metadata?: any;
}

interface ResearchChatProps {
  className?: string;
  onLocationAnalysis?: (location: string) => void;
}

// Predefined research queries for quick access
const QUICK_RESEARCH_QUERIES = [
  {
    id: "crime-safety",
    label: "Crime & Safety Analysis",
    icon: AlertCircle,
    query: "What crime and safety data is available for this area?",
    type: "crime",
  },
  {
    id: "market-trends",
    label: "Market Trends", 
    icon: TrendingUp,
    query: "Show me market trends and demographic data for this location.",
    type: "market",
  },
  {
    id: "zoning-permits",
    label: "Zoning & Permits",
    icon: Building2,
    query: "Find zoning information and building permits for this area.",
    type: "zoning",
  },
  {
    id: "location-analysis",
    label: "Location Analysis",
    icon: MapPin,
    query: "Provide a comprehensive analysis of this location for real estate investment.",
    type: "location",
  },
];

export function ResearchChat({ className, onLocationAnalysis }: ResearchChatProps) {
  const [messages, setMessages] = useState<ResearchMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to the Research Hub! I'm your real estate research assistant powered by government data from Data.gov. I can help you analyze:\n\n- **Crime & Safety Data** - Police reports, incident statistics\n- **Market Analysis** - Demographics, economics, trends\n- **Zoning & Planning** - Building permits, development approvals\n- **Environmental Factors** - Air quality, flood zones\n- **Transportation** - Traffic counts, public transit\n\nAsk me about any location or use the quick research buttons below!",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Extract images from markdown content
  const extractImages = (content: string): string[] => {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const images: string[] = [];
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      images.push(match[1]);
    }
    
    return images;
  };

  // Generate visualization from chat history
  const generateVisualization = async () => {
    if (messages.length <= 1 || isGeneratingVisualization) return; // Skip if only welcome message

    setIsGeneratingVisualization(true);

    try {
      // Collect all chat messages (exclude welcome message)
      const chatHistory = messages
        .filter(msg => msg.id !== "welcome")
        .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n\n");

      const request: VisualizationRequest = {
        request: `Create a visualization based on this real estate research conversation. Generate a chart, graph, or visual representation that would be most helpful for understanding the data discussed:\n\n${chatHistory}`,
        data_context: locationInput ? `Location: ${locationInput}` : undefined,
        include_metadata: true,
      };

      const response: VisualizationResponse = await backendAPI.visualizationQuery(request);

      if (response.success) {
        // Extract any image URLs from the response
        const images = extractImages(response.response);
        
        const visualizationMessage: ResearchMessage = {
          id: generateUUID(),
          role: "assistant",
          content: `🎨 **Visualization Generated**\n\n${response.response}`,
          timestamp: new Date().toLocaleTimeString(),
          analysis_type: "visualization",
          images: images.length > 0 ? images : undefined,
          metadata: response.metadata,
        };

        setMessages(prev => [...prev, visualizationMessage]);
        toast.success("Visualization generated successfully!");
      } else {
        throw new Error(response.error || "Visualization generation failed");
      }
    } catch (error) {
      console.error("Visualization generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate visualization";
      
      const errorChatMessage: ResearchMessage = {
        id: generateUUID(),
        role: "assistant",
        content: `**Error:** Failed to generate visualization: ${errorMessage}\n\nPlease try again or make sure the visualization service is available.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      toast.error(`Visualization failed: ${errorMessage}`);
    } finally {
      setIsGeneratingVisualization(false);
    }
  };

  const sendResearchQuery = async (query: string, analysisType?: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: ResearchMessage = {
      id: generateUUID(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString(),
      analysis_type: analysisType,
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage("");
    setIsLoading(true);

    try {
      let response: ResearchQueryResponse | IntegratedAnalysisResponse;
      
      // Use integrated analysis for location-based queries
      if (analysisType === "location" || analysisType === "crime" || analysisType === "market") {
        let location = locationInput;
        
        // Try to extract location from query if not provided
        if (!location) {
          const locationMatch = query.match(/(?:in|for|at|near)\s+([^,.!?]+)/i);
          if (locationMatch) {
            location = locationMatch[1].trim();
          }
        }

        if (location) {
          const request: IntegratedAnalysisRequest = {
            location,
            analysis_focus: analysisType === "crime" ? "crime and safety" : 
                          analysisType === "market" ? "demographics and market" : 
                          "comprehensive",
            include_metadata: true,
          };

          if (analysisType === "crime") {
            response = await backendAPI.crimeAnalysis(location);
          } else if (analysisType === "market") {
            response = await backendAPI.marketAnalysis(location);
          } else {
            response = await backendAPI.integratedAnalysis(request);
          }

          // Trigger location analysis callback if provided
          if (onLocationAnalysis) {
            onLocationAnalysis(location);
          }
        } else {
          // Fallback to regular research query
          const request: ResearchQueryRequest = {
            question: query,
            include_metadata: true,
          };
          response = await backendAPI.researchQuery(request);
        }
      } else {
        // Regular research query
        const request: ResearchQueryRequest = {
          question: query,
          include_metadata: true,
        };
        response = await backendAPI.researchQuery(request);
      }

      if (response.success) {
        const images = extractImages(response.response);
        
        const assistantMessage: ResearchMessage = {
          id: generateUUID(),
          role: "assistant",
          content: response.response,
          timestamp: new Date().toLocaleTimeString(),
          analysis_type: analysisType,
          location: 'location' in response ? response.location : locationInput,
          images: images.length > 0 ? images : undefined,
          metadata: response.metadata,
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || "Research query failed");
      }
    } catch (error) {
      console.error("Research query error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send research query";
      
      const errorChatMessage: ResearchMessage = {
        id: generateUUID(),
        role: "assistant",
        content: `**Error:** ${errorMessage}\n\nPlease try again or rephrase your question. Make sure the backend API is running and accessible.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      toast.error(`Research query failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResearchQuery(currentMessage);
  };

  const handleQuickQuery = async (queryItem: typeof QUICK_RESEARCH_QUERIES[0]) => {
    let fullQuery = queryItem.query;
    
    // Add location context if provided
    if (locationInput && (queryItem.type === "location" || queryItem.type === "crime" || queryItem.type === "market")) {
      fullQuery = `${queryItem.query} Location: ${locationInput}`;
    }
    
    await sendResearchQuery(fullQuery, queryItem.type);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Research Assistant
        </CardTitle>
        
        {/* Location Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter location (city, address, zip code)..."
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (locationInput) {
                sendResearchQuery(`Analyze this location for real estate investment: ${locationInput}`, "location");
              }
            }}
            disabled={!locationInput || isLoading || isGeneratingVisualization}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Analyze
          </Button>
        </div>
      </CardHeader>

      {/* Quick Research Buttons */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_RESEARCH_QUERIES.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickQuery(item)}
              disabled={isLoading || isGeneratingVisualization}
              className="justify-start"
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.label}
            </Button>
          ))}
        </div>
        
        {/* Visualization Button */}
        {messages.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generateVisualization}
              disabled={isLoading || isGeneratingVisualization}
              className="w-full justify-start"
            >
              {isGeneratingVisualization ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Visualization...
                </>
              ) : (
                <>
                  <PieChart className="h-4 w-4 mr-2" />
                  Generate Visualization
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 px-1">
              Create charts and graphs from your research conversation
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex gap-3 max-w-[80%]",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border",
                    message.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                {/* Message Content */}
                <div className="flex flex-col gap-2">
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Custom image renderer to handle embedded images
                            img: ({ src, alt }) => (
                              <img 
                                src={src} 
                                alt={alt} 
                                className="max-w-full h-auto rounded-md my-2"
                                onError={(e) => {
                                  console.error("Failed to load image:", src);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ),
                            // Style links appropriately
                            a: ({ href, children }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Message Metadata */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{message.timestamp}</span>
                    {message.analysis_type && (
                      <Badge variant="outline" className="text-xs">
                        {message.analysis_type}
                      </Badge>
                    )}
                    {message.location && (
                      <Badge variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {message.location}
                      </Badge>
                    )}
                  </div>

                  {/* Embedded Images */}
                  {message.images && message.images.length > 0 && (
                    <div className="grid gap-2 mt-2">
                      {message.images.map((imageUrl, index) => (
                        <img
                          key={index}
                          src={imageUrl}
                          alt={`Research visualization ${index + 1}`}
                          className="max-w-full h-auto rounded-md border"
                          onError={(e) => {
                            console.error("Failed to load embedded image:", imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {(isLoading || isGeneratingVisualization) && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg border px-3 py-2 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {isGeneratingVisualization ? "Generating visualization..." : "Researching..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </CardContent>

      {/* Input Form */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Ask about real estate data, market trends, crime statistics, zoning info..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            disabled={isLoading || isGeneratingVisualization}
            className="flex-1"
          />
          <Button type="submit" disabled={!currentMessage.trim() || isLoading || isGeneratingVisualization}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        
        <p className="text-xs text-muted-foreground mt-2">
          Powered by Data.gov real estate intelligence • Ask about any US location
        </p>
      </div>
    </div>
  );
}
