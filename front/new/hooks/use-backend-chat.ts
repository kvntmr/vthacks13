"use client";

import { useCallback, useState, useRef } from 'react';
import { backendAPI, type ChatMessage, type ChatRequest } from '@/lib/api/backend';
import { generateUUID } from '@/lib/utils';

export interface BackendChatMessage extends ChatMessage {
  id: string;
}

export interface UseBackendChatReturn {
  messages: BackendChatMessage[];
  sendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  conversationId: string | null;
}

export function useBackendChat(): UseBackendChatReturn {
  const [messages, setMessages] = useState<BackendChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: BackendChatMessage = {
      id: generateUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        message,
        conversation_id: conversationIdRef.current || undefined,
      };

      console.log('Sending message to backend:', request);
      const response = await backendAPI.chat(request);
      console.log('Received response from backend:', response);
      
      // Update conversation ID if we got one back
      if (response.conversation_id) {
        conversationIdRef.current = response.conversation_id;
      }

      const assistantMessage: BackendChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message to backend:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Add error message to chat
      const errorChatMessage: BackendChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearError,
    conversationId: conversationIdRef.current,
  };
}
