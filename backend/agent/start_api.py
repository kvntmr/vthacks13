#!/usr/bin/env python3
"""
Startup script for the Commercial Real Estate Due Diligence API

This script provides a simple way to start the API server with proper configuration
and environment setup.
"""

import os
import sys
import argparse
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed."""
    required_packages = ["fastapi", "uvicorn", "langchain", "httpx", "pandas"]
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("❌ Missing required dependencies:")
        for package in missing_packages:
            print(f"   - {package}")
        print("\nPlease install dependencies with:")
        print("   pip install -r requirements.txt")
        return False
    
    return True


def check_api_key():
    """Check if Google API key is available."""
    if not os.getenv("GOOGLE_API_KEY"):
        print("⚠️  Warning: GOOGLE_API_KEY environment variable not set.")
        print("   The agent will prompt for it when first accessed.")
        print("   For better performance, set it as an environment variable:")
        print("   export GOOGLE_API_KEY='your-api-key-here'")
        return False
    
    print("✅ Google API key found in environment")
    return True


def main():
    """Main startup function."""
    parser = argparse.ArgumentParser(
        description="Start the Commercial Real Estate Due Diligence API"
    )
    parser.add_argument(
        "--host", 
        default="0.0.0.0", 
        help="Host to bind the server to (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", 
        type=int, 
        default=8000, 
        help="Port to bind the server to (default: 8000)"
    )
    parser.add_argument(
        "--reload", 
        action="store_true", 
        help="Enable auto-reload for development"
    )
    parser.add_argument(
        "--workers", 
        type=int, 
        default=1, 
        help="Number of worker processes (default: 1)"
    )
    parser.add_argument(
        "--log-level", 
        default="info", 
        choices=["critical", "error", "warning", "info", "debug", "trace"],
        help="Log level (default: info)"
    )
    parser.add_argument(
        "--check-only", 
        action="store_true", 
        help="Only check dependencies and configuration, don't start server"
    )
    
    args = parser.parse_args()
    
    print("🏢 Commercial Real Estate Due Diligence API")
    print("=" * 50)
    
    # Check dependencies
    print("🔍 Checking dependencies...")
    if not check_dependencies():
        sys.exit(1)
    print("✅ All required dependencies are installed")
    
    # Check API key
    print("\n🔑 Checking API configuration...")
    check_api_key()
    
    # Check if API files exist
    print("\n📁 Checking API files...")
    api_file = Path("api.py")
    agent_file = Path("real_estate_agent.py")
    tooling_file = Path("tooling.py")
    
    if not api_file.exists():
        print("❌ api.py not found")
        sys.exit(1)
    if not agent_file.exists():
        print("❌ real_estate_agent.py not found")
        sys.exit(1)
    if not tooling_file.exists():
        print("❌ tooling.py not found")
        sys.exit(1)
    
    print("✅ All API files found")
    
    if args.check_only:
        print("\n✅ All checks passed! You can start the API server.")
        return
    
    # Start the server
    print(f"\n🚀 Starting API server on {args.host}:{args.port}")
    print(f"📚 API documentation: http://{args.host}:{args.port}/docs")
    print(f"🔍 Interactive docs: http://{args.host}:{args.port}/redoc")
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        import uvicorn
        uvicorn.run(
            "api:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            workers=args.workers if not args.reload else 1,  # reload mode requires single worker
            log_level=args.log_level,
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped gracefully")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
