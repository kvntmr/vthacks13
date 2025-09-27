from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import standards, policies, risk, workflows, admin

app = FastAPI(
    title="Compliance & Risk Management API",
    description="API for compliance checking and risk assessment against industry and government standards",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(standards.router, prefix="/api/v1")
app.include_router(policies.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "Compliance & Risk Management API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
