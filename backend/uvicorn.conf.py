"""
Uvicorn configuration file
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,  # Change this to your desired port
        reload=True,
        log_level="info"
    )
