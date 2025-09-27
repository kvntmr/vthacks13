"""
Main FastAPI application for Real Estate Investment Analysis
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import powerpoint

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
