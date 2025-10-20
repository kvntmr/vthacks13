# VTHacks13 - AI-Powered Real Estate Investment Platform

A comprehensive full-stack application that combines AI-powered document analysis with real estate investment screening. Built with FastAPI backend and Next.js frontend, featuring advanced LangChain integration for intelligent property data extraction and analysis.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI       │    │   AI Services   │
│   Frontend      │◄──►│   Backend       │◄──►│   (LangChain)   │
│                 │    │                 │    │                 │
│ • Chat UI       │    │ • REST APIs     │    │ • Gemini 2.5    │
│ • Document Mgmt │    │ • File Upload   │    │ • Vector Search │
│ • Real-time     │    │ • Auth System   │    │ • Data Extract  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ✨ Key Features

### 🤖 AI-Powered Analysis
- **Intelligent Document Processing**: Automatically extracts property data from various document formats (PDF, Excel, CSV, PowerPoint, etc.)
- **Data-Driven Screening**: AI agent with emphasis on facts and quantitative analysis
- **Memory-Based Search**: Vector database for intelligent document retrieval and context
- **Multi-Format Support**: Handles PDFs, Excel files, PowerPoint presentations, Word documents, and more

### 📊 Real Estate Investment Tools
- **Property Data Extraction**: Structured extraction of financial metrics, property details, and market data
- **Investment Screening**: Comprehensive analysis of real estate opportunities
- **Portfolio Management**: Track and analyze multiple properties
- **Risk Assessment**: Data-driven risk evaluation and mitigation strategies

### 🔧 Technical Features
- **Modern Tech Stack**: FastAPI + Next.js 15 with TypeScript
- **AI Integration**: LangChain with Google Gemini 2.5 Pro
- **Vector Database**: ChromaDB for document memory and search
- **Real-time Chat**: Interactive AI agent with conversation context
- **File Processing**: OCR, document parsing, and data extraction
- **Authentication**: JWT-based security system

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- pnpm (recommended) or npm
- Google Gemini API key

### 1. Clone and Setup
```bash
git clone <repository-url>
cd vthacks13
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY
```

### 3. Frontend Setup
```bash
cd front/new

# Install dependencies
pnpm install

# Set up environment variables (if needed)
cp .env.example .env.local
```

### 4. Run the Application

#### Option A: Using Make (Recommended)
```bash
# From project root
make dev
```

#### Option B: Manual Setup
```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd front/new
pnpm dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📁 Project Structure

```
vthacks13/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/            # API endpoints
│   │   │   ├── ai_agent.py    # AI chat endpoints
│   │   │   ├── documents.py   # Document management
│   │   │   └── auth.py        # Authentication
│   │   ├── core/              # Core modules
│   │   │   ├── langchain/     # LangChain integration
│   │   │   ├── langgraph/     # LangGraph workflows
│   │   │   └── database/      # Database models
│   │   ├── services/          # Business logic
│   │   │   ├── memory_screening_service.py
│   │   │   ├── property_extraction_agent.py
│   │   │   └── [file parsers] # Document parsers
│   │   └── main.py            # FastAPI app
│   ├── test_documents/        # Sample documents
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile
├── front/new/                 # Next.js Frontend
│   ├── app/                   # App Router
│   │   ├── (auth)/           # Authentication pages
│   │   ├── (chat)/           # Chat interface
│   │   └── layout.tsx        # Root layout
│   ├── components/           # React components
│   │   ├── chat.tsx          # Chat interface
│   │   ├── document.tsx      # Document viewer
│   │   └── ui/               # UI components
│   ├── lib/                  # Utilities and types
│   └── package.json          # Node dependencies
├── Makefile                  # Development commands
└── README.md                 # This file
```

## 🔌 API Endpoints

### AI Agent Endpoints
- `POST /api/v1/ai-agent/chat` - Chat with AI agent
- `POST /api/v1/ai-agent/search-memory` - Search document memory
- `GET /api/v1/ai-agent/health` - Service health check
- `GET /api/v1/ai-agent/conversation-stats` - Conversation statistics

### Document Management
- `POST /api/v1/documents/upload` - Upload documents
- `GET /api/v1/documents/` - List documents
- `GET /api/v1/documents/{id}` - Get document details
- `DELETE /api/v1/documents/{id}` - Delete document

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh token

## 🤖 AI Agent Commands

The AI agent supports special commands for enhanced functionality:

- `@screener` - Run comprehensive screening on all documents (RAG)
- `@memory [query]` - Search memory for specific information (RAG)
- `@deep [question]` - Ask the Data.gov deep analysis agent; it uses chat and document context where relevant
- `@stats` - Show memory statistics and document counts
- `@help` - Display available commands

### Example Usage
```
User: @screener
AI: 🔍 **MEMORY SCREENING RESULTS** [Detailed analysis of all documents]

User: @memory market trends
AI: 🔍 **Memory Search Results** [Relevant market trend information]

User: @deep Crime data for Austin, TX
AI: 📊 **Deep Analysis** [Findings using Data.gov datasets, leveraging chat/document context]

User: What's my portfolio performance?
AI: [Data-driven analysis based on uploaded documents]
```

## 📊 Supported Document Types

The system can process and extract data from:

- **PDFs** - Property reports, financial statements
- **Excel/CSV** - Financial data, market analysis
- **PowerPoint** - Investment presentations
- **Word Documents** - Property descriptions, legal docs
- **RTF/ODT** - Alternative document formats
- **Text Files** - Raw data and notes

## 🔧 Configuration

### Environment Variables

#### Backend (.env.local)
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## 🐳 Docker Deployment

### Backend
```bash
cd backend/docker
docker-compose up --build
```

### Frontend
```bash
cd front/new
docker build -t vthacks13-frontend .
docker run -p 3000:3000 vthacks13-frontend
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
source .venv/bin/activate
pytest
```

### Frontend Tests
```bash
cd front/new
pnpm test
```

## 📈 Performance Features

- **Optimized Document Processing**: Efficient parsing with content truncation for large files
- **Caching**: Redis-based caching for improved response times
- **Vector Search**: Fast semantic search using ChromaDB
- **Async Processing**: Non-blocking operations for better user experience
- **Memory Management**: Intelligent document memory with cleanup

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Pydantic models for request validation
- **CORS Configuration**: Proper cross-origin resource sharing
- **File Upload Security**: Validated file types and sizes
- **Environment Variables**: Secure configuration management

## 🛠️ Development Tools

### Code Quality
- **Ultracite**: Lightning-fast formatter and linter
- **TypeScript**: Full type safety in frontend
- **Pydantic**: Data validation in backend
- **Biome**: Code formatting and linting

### Development Commands
```bash
# Format code
make format

# Run linting
make lint

# Start development servers
make dev

# Run tests
make test
```

## 📚 Documentation

- **API Documentation**: Available at http://localhost:8000/docs (Swagger UI)
- **Frontend Integration Guide**: See `backend/FRONTEND_INTEGRATION_GUIDE.md`
- **Component Documentation**: Inline JSDoc comments in React components

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the frontend integration guide

## 🎯 Roadmap

- [ ] Real-time collaboration features
- [ ] Advanced portfolio analytics
- [ ] Integration with real estate APIs
- [ ] Mobile application
- [ ] Advanced AI model fine-tuning
- [ ] Multi-tenant support

---

**Built with ❤️ for VTHacks13**
