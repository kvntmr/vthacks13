# FastAPI + LangChain + LangGraph Backend

A modern FastAPI backend that integrates LangChain for LLM orchestration and LangGraph for complex workflow management.

## Features

- FastAPI with async support
- LangChain integration for LLM orchestration
- LangGraph workflows for complex multi-step processes
- JWT-based authentication
- Redis caching
- Document processing and vector search
- Multi-LLM provider support (OpenAI, Anthropic, Azure, Google)

## Quick Start

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. Run the application:
```bash
uvicorn app.main:app --reload
```

## Docker

```bash
cd docker
docker-compose up --build
```

## Project Structure

- `app/` - Main application code
- `app/auth/` - Authentication module
- `app/api/` - API endpoints
- `app/core/` - Core modules (langchain, langgraph, models)
- `app/services/` - Business logic services
- `app/utils/` - Utility functions
- `tests/` - Test files
- `docker/` - Docker configuration
