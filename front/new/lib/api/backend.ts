/**
 * Backend API client for communicating with the Python backend
 */

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  timestamp: string;
}

export interface FileUploadResponse {
  message: string;
  file_ids: string[];
  success: boolean;
}

export interface ProcessFolderResponse {
  message: string;
  file_ids: string[];
  success: boolean;
}

export interface ClearMemoryResponse {
  message: string;
  success: boolean;
}

export interface DeleteSelectedResponse {
  message: string;
  deleted_count: number;
  success: boolean;
}

export interface ResearchQueryRequest {
  question: string;
  include_metadata?: boolean;
}

export interface ResearchQueryResponse {
  success: boolean;
  response: string;
  message_count?: number;
  error?: string;
  metadata?: any;
}

export interface VisualizationRequest {
  request: string;
  data_context?: string;
  include_metadata?: boolean;
}

export interface VisualizationResponse {
  success: boolean;
  response: string;
  mcp_connected: boolean;
  tools_available: boolean;
  message_count?: number;
  error?: string;
  metadata?: any;
}

export interface IntegratedAnalysisRequest {
  location: string;
  analysis_focus?: string;
  include_metadata?: boolean;
}

export interface IntegratedAnalysisResponse {
  success: boolean;
  location: string;
  analysis_focus: string;
  data_analysis?: any;
  visualizations?: any;
  errors: string[];
  metadata?: any;
}

class BackendAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'BackendAPIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData: any = null;
    
    try {
      const responseText = await response.text();
      console.log('Error response text:', responseText);
      
      if (responseText) {
        errorData = JSON.parse(responseText);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      }
    } catch (parseError) {
      console.log('Could not parse error response as JSON');
    }
    
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
      errorData,
      url: response.url
    });
    
    throw new BackendAPIError(errorMessage, response.status, errorData);
  }

  return response.json();
}

export class BackendAPI {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a chat message to the AI agent
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    console.log('Sending chat request to:', `${this.baseUrl}/api/v1/ai-agent/chat`);
    console.log('Request payload:', request);
    
    const response = await fetch(`${this.baseUrl}/api/v1/ai-agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    return handleResponse<ChatResponse>(response);
  }

  /**
   * Upload files to be processed by the AI agent
   */
  async processUploadParallel(files: File[]): Promise<FileUploadResponse> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${this.baseUrl}/api/v1/process-upload-parallel`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse<FileUploadResponse>(response);
  }

  /**
   * Process all files in a folder
   */
  async processFolder(folderPath: string): Promise<ProcessFolderResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/process-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folder_path: folderPath }),
    });

    return handleResponse<ProcessFolderResponse>(response);
  }

  /**
   * Clear all files from memory
   */
  async clearAllMemory(): Promise<ClearMemoryResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/files/memory/clear-all`, {
      method: 'POST',
    });

    return handleResponse<ClearMemoryResponse>(response);
  }

  /**
   * Delete selected documents from memory
   */
  async deleteSelectedDocuments(fileIds: string[]): Promise<DeleteSelectedResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/files/memory/documents/delete-selected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    });

    return handleResponse<DeleteSelectedResponse>(response);
  }

  /**
   * Test the connection to the backend
   */
  async testConnection(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'GET',
      });
      
      if (response.ok) {
        return { status: 'success', message: 'Backend is accessible' };
      } else {
        return { status: 'error', message: `Backend returned ${response.status}` };
      }
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Send a research query to the real estate agent
   */
  async researchQuery(request: ResearchQueryRequest): Promise<ResearchQueryResponse> {
    console.log('Sending research query to:', `${this.baseUrl}/query/sync`);
    console.log('Request payload:', request);
    
    const response = await fetch(`${this.baseUrl}/query/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('Research response status:', response.status);

    return handleResponse<ResearchQueryResponse>(response);
  }

  /**
   * Send a visualization request
   */
  async visualizationQuery(request: VisualizationRequest): Promise<VisualizationResponse> {
    console.log('Sending visualization query to:', `${this.baseUrl}/visualization/query`);
    console.log('Request payload:', request);
    
    const response = await fetch(`${this.baseUrl}/visualization/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('Visualization response status:', response.status);

    return handleResponse<VisualizationResponse>(response);
  }

  /**
   * Send an integrated analysis request
   */
  async integratedAnalysis(request: IntegratedAnalysisRequest): Promise<IntegratedAnalysisResponse> {
    console.log('Sending integrated analysis to:', `${this.baseUrl}/integrated/analyze`);
    console.log('Request payload:', request);
    
    const response = await fetch(`${this.baseUrl}/integrated/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('Integrated analysis response status:', response.status);

    return handleResponse<IntegratedAnalysisResponse>(response);
  }

  /**
   * Quick crime analysis for a location
   */
  async crimeAnalysis(location: string): Promise<IntegratedAnalysisResponse> {
    console.log('Sending crime analysis for location:', location);
    
    const response = await fetch(`${this.baseUrl}/integrated/crime-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location }),
    });

    console.log('Crime analysis response status:', response.status);

    return handleResponse<IntegratedAnalysisResponse>(response);
  }

  /**
   * Quick market analysis for a location
   */
  async marketAnalysis(location: string): Promise<IntegratedAnalysisResponse> {
    console.log('Sending market analysis for location:', location);
    
    const response = await fetch(`${this.baseUrl}/integrated/market-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location }),
    });

    console.log('Market analysis response status:', response.status);

    return handleResponse<IntegratedAnalysisResponse>(response);
  }
}

// Export a default instance
export const backendAPI = new BackendAPI();
