"use client";

import { useState, useRef, useCallback } from 'react';
import { useBackendChat } from '@/hooks/use-backend-chat';
import { backendAPI } from '@/lib/api/backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  PaperclipIcon, 
  FolderIcon, 
  TrashIcon, 
  AlertCircleIcon,
  SendIcon,
  LoaderIcon
} from '@/components/icons';
import { toast } from 'sonner';

interface BackendChatProps {
  className?: string;
}

export function BackendChat({ className }: BackendChatProps) {
  const { messages, sendMessage, isLoading, error, clearError } = useBackendChat();
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingFolder, setIsProcessingFolder] = useState(false);
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useState(() => {
    scrollToBottom();
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  }, [input, isLoading, sendMessage]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const response = await backendAPI.processUploadParallel(files);
      if (response.success) {
        toast.success(`Successfully uploaded ${response.file_ids.length} file(s)`);
      } else {
        toast.error(response.message || 'Failed to upload files');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload files';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // For folder processing, we'll use the first file's directory path
    const folderPath = files[0].webkitRelativePath.split('/')[0];
    
    setIsProcessingFolder(true);
    try {
      const response = await backendAPI.processFolder(folderPath);
      if (response.success) {
        toast.success(`Successfully processed folder with ${response.file_ids.length} file(s)`);
      } else {
        toast.error(response.message || 'Failed to process folder');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process folder';
      toast.error(errorMessage);
    } finally {
      setIsProcessingFolder(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  }, []);

  const handleClearMemory = useCallback(async () => {
    setIsClearingMemory(true);
    try {
      const response = await backendAPI.clearAllMemory();
      if (response.success) {
        toast.success('Memory cleared successfully');
      } else {
        toast.error(response.message || 'Failed to clear memory');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear memory';
      toast.error(errorMessage);
    } finally {
      setIsClearingMemory(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    try {
      console.log('Testing backend connection...');
      const result = await backendAPI.testConnection();
      console.log('Connection test result:', result);
      
      if (result.status === 'success') {
        toast.success('Backend connection successful!');
      } else {
        toast.error(`Connection test failed: ${result.message}`);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      toast.error(`Connection test failed: ${errorMessage}`);
    }
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with actions */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div>
              <span>AI Agent Chat</span>
              <div className="text-xs text-muted-foreground mt-1">
                Backend: {process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <PaperclipIcon className="w-4 h-4" />
                )}
                Upload Files
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                disabled={isProcessingFolder}
              >
                {isProcessingFolder ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderIcon className="w-4 h-4" />
                )}
                Process Folder
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearMemory}
                disabled={isClearingMemory}
              >
                {isClearingMemory ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <TrashIcon className="w-4 h-4" />
                )}
                Clear Memory
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
              >
                Test Connection
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.rtf,.odt"
      />
      
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        onChange={handleFolderUpload}
        className="hidden"
      />

      {/* Error display */}
      {error && (
        <Alert className="mb-4" variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Welcome to AI Agent Chat</p>
                <p className="text-sm">Start a conversation or upload files to provide context</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                        {message.role}
                      </Badge>
                      {message.timestamp && (
                        <span className="text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <LoaderIcon className="w-4 h-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input form */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <LoaderIcon className="w-4 h-4 animate-spin" />
              ) : (
                <SendIcon className="w-4 h-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
