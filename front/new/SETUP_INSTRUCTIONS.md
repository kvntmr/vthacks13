# Live Chat Setup Instructions

## ✅ **Fixed: Chat Now Uses Live API Calls**

The chat interface has been updated to make **real API calls** to your Python backend instead of showing mock responses.

## 🚀 **Quick Setup**

1. **Set Backend URL** (create `.env.local` file):
   ```bash
   echo "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000" > .env.local
   ```

2. **Start Your Backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Start Frontend**:
   ```bash
   cd front/new
   npm run dev
   ```

4. **Test the Chat**:
   - Go to `http://localhost:3000`
   - Type a message in the chat
   - You should see real responses from your AI backend

## 🔧 **What Was Fixed**

- **Replaced mock responses** with real API calls to `/api/v1/ai-agent/chat`
- **Added file upload integration** with `/api/v1/process-upload-parallel`
- **Added folder processing** with `/api/v1/process-folder`
- **Added conversation ID tracking** for context continuity
- **Added comprehensive error handling** with user feedback

## 📡 **API Endpoints Used**

- `POST /api/v1/ai-agent/chat` - Chat messages
- `POST /api/v1/process-upload-parallel` - File uploads
- `POST /api/v1/process-folder` - Folder processing
- `POST /api/v1/files/memory/clear-all` - Clear memory

## 🐛 **Debugging**

- Check browser console for detailed API call logs
- Verify backend is running on `http://127.0.0.1:8000`
- Check network tab for failed requests
- Look for CORS errors if backend doesn't allow frontend requests

The chat is now **fully live** and will display real responses from your AI backend!
