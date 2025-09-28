# Backend API Setup

## Environment Configuration

To connect the frontend to your Python backend, you need to set the backend URL. Create a `.env.local` file in the frontend root directory:

```bash
# Create the environment file
echo "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000" > .env.local
```

Or manually create `.env.local` with the following content:

```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

## Backend Requirements

Make sure your Python backend is running on `http://127.0.0.1:8000` with the following endpoints:

- `POST /api/v1/ai-agent/chat` - Chat with the AI agent
- `POST /api/v1/process-upload-parallel` - Upload files for processing
- `POST /api/v1/process-folder` - Process entire folders
- `POST /api/v1/files/memory/clear-all` - Clear all memory
- `POST /api/v1/files/memory/documents/delete-selected` - Delete selected documents
- `GET /docs` - API documentation (for connection testing)

## Testing the Connection

1. Start your Python backend server
2. Start the Next.js frontend: `npm run dev`
3. Navigate to the "AI Agent Chat" in the sidebar
4. Click the "Test Connection" button to verify the backend is accessible
5. Try sending a message to test the chat functionality

## Troubleshooting

### Connection Issues

If you see connection errors:

1. **Check if the backend is running**: Visit `http://127.0.0.1:8000/docs` in your browser
2. **Verify the URL**: The backend URL is displayed in the chat header
3. **Check CORS settings**: Make sure your backend allows requests from the frontend
4. **Check the console**: Open browser dev tools to see detailed error messages

### Common Issues

- **CORS errors**: Add CORS middleware to your FastAPI backend
- **Port conflicts**: Make sure port 8000 is available for the backend
- **Environment variables**: Restart the Next.js dev server after changing `.env.local`

## API Endpoints

The frontend expects these specific request/response formats:

### Chat Request
```json
{
  "message": "Hello, how are you?",
  "conversation_id": "optional-conversation-id"
}
```

### Chat Response
```json
{
  "response": "I'm doing well, thank you!",
  "conversation_id": "conversation-id",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### File Upload Response
```json
{
  "message": "Files uploaded successfully",
  "file_ids": ["file-id-1", "file-id-2"],
  "success": true
}
```
