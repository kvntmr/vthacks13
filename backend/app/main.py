"""
Main FastAPI application for Real Estate Investment Analysis
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import powerpoint, file_processing, memory_screening, ai_agent

app = FastAPI(
    title="Real Estate Investment Analysis API",
    description="API for analyzing real estate investments with focus on land value and development potential",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(powerpoint.router, prefix="/api/v1")
app.include_router(file_processing.router, prefix="/api/v1")
app.include_router(memory_screening.router, prefix="/api/v1")
app.include_router(ai_agent.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "Real Estate Investment Analysis API", 
        "version": "1.0.0",
        "description": "API for analyzing real estate investments with focus on land value and development potential"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "real_estate_analysis_api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)  # Change 8001 to your desired port
