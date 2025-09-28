#!/usr/bin/env python3
"""
Setup script for LangGraph Visualization Agent

This script helps set up and verify the visualization agent installation.
"""

import os
import sys
import subprocess
import asyncio
from pathlib import Path


def run_command(command, description):
    """Run a shell command and return success status."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            return True
        else:
            print(f"❌ {description} failed:")
            print(f"   {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} failed: {str(e)}")
        return False


def check_dependencies():
    """Check if required dependencies are installed."""
    print("📦 Checking dependencies...")
    
    required_packages = [
        "langchain_mcp_adapters",
        "langgraph", 
        "langchain",
        "fastapi",
        "uvicorn",
        "pandas",
        "httpx"
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} (missing)")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n🚨 Missing packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies are installed")
    return True


def check_environment():
    """Check environment variables."""
    print("\n🌍 Checking environment...")
    
    google_key = os.getenv("GOOGLE_API_KEY")
    if google_key:
        print("   ✅ GOOGLE_API_KEY is set")
        return True
    else:
        print("   ⚠️  GOOGLE_API_KEY not set")
        print("   Set with: export GOOGLE_API_KEY='your_key_here'")
        return False


def check_files():
    """Check if all required files exist."""
    print("\n📁 Checking files...")
    
    required_files = [
        "visualization_agent.py",
        "integrated_agents_example.py", 
        "real_estate_agent.py",
        "tooling.py",
        "api.py",
        "requirements.txt"
    ]
    
    missing_files = []
    current_dir = Path(".")
    
    for file in required_files:
        file_path = current_dir / file
        if file_path.exists():
            print(f"   ✅ {file}")
        else:
            print(f"   ❌ {file} (missing)")
            missing_files.append(file)
    
    if missing_files:
        print(f"\n🚨 Missing files: {', '.join(missing_files)}")
        return False
    
    print("✅ All required files are present")
    return True


async def test_agents():
    """Test agent functionality."""
    print("\n🧪 Testing agents...")
    
    try:
        # Test real estate agent
        from real_estate_agent import create_real_estate_agent
        print("   ✅ Real estate agent can be imported")
        
        # Test visualization agent
        from visualization_agent import create_visualization_agent
        print("   ✅ Visualization agent can be imported")
        
        # Test integrated system
        from integrated_agents_example import IntegratedRealEstateAnalysis
        print("   ✅ Integrated system can be imported")
        
        # Create agents (this will test basic initialization)
        if os.getenv("GOOGLE_API_KEY"):
            try:
                viz_agent = create_visualization_agent()
                print("   ✅ Visualization agent created successfully")
                
                # Test MCP connection (non-blocking)
                tools = await viz_agent.get_available_tools()
                if tools:
                    print(f"   ✅ MCP server connected - {len(tools)} tools available")
                else:
                    print("   ⚠️  MCP server not connected or no tools available")
                    print("      Make sure MCP server is running at http://localhost:1122/mcp")
                
            except Exception as e:
                print(f"   ⚠️  Agent creation failed: {str(e)}")
        else:
            print("   ⚠️  Skipping agent creation (no API key)")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Agent testing failed: {str(e)}")
        return False


def check_mcp_server():
    """Check if MCP server is accessible."""
    print("\n🔗 Checking MCP server...")
    
    import httpx
    
    try:
        # Try to connect to the MCP server
        response = httpx.get("http://localhost:1122/mcp", timeout=5.0)
        if response.status_code == 200:
            print("   ✅ MCP server is accessible")
            return True
        else:
            print(f"   ⚠️  MCP server responded with status {response.status_code}")
            return False
    except httpx.ConnectError:
        print("   ❌ MCP server is not accessible at http://localhost:1122/mcp")
        print("      Make sure your MCP visualization server is running")
        return False
    except Exception as e:
        print(f"   ❌ MCP server check failed: {str(e)}")
        return False


def print_next_steps(all_checks_passed):
    """Print next steps based on setup results."""
    print("\n" + "="*60)
    print("📋 SETUP SUMMARY")
    print("="*60)
    
    if all_checks_passed:
        print("🎉 Setup completed successfully!")
        print("\n🚀 Next steps:")
        print("1. Start your MCP visualization server on port 1122")
        print("2. Run tests: python test_visualization_agent.py")
        print("3. Start API: python api.py")
        print("4. Access docs: http://localhost:8000/docs")
        
        print("\n💡 Quick test commands:")
        print("   python test_visualization_agent.py")
        print("   python test_visualization_agent.py interactive")
        print("   python visualization_agent.py")
        print("   python integrated_agents_example.py interactive")
        
    else:
        print("⚠️  Setup incomplete. Please address the issues above.")
        print("\n🔧 Common fixes:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Set API key: export GOOGLE_API_KEY='your_key'") 
        print("3. Start MCP server: ensure it's running on localhost:1122")
        print("4. Check file permissions and paths")


async def main():
    """Main setup function."""
    print("🔧 LangGraph Visualization Agent Setup")
    print("="*50)
    
    checks = [
        ("Files", check_files()),
        ("Dependencies", check_dependencies()),
        ("Environment", check_environment()),
        ("MCP Server", check_mcp_server()),
        ("Agents", await test_agents())
    ]
    
    all_passed = True
    for name, result in checks:
        if not result:
            all_passed = False
    
    print_next_steps(all_passed)
    
    return all_passed


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--install-deps":
        print("📦 Installing dependencies...")
        success = run_command("pip install -r requirements.txt", "Installing requirements")
        if success:
            print("✅ Dependencies installed. Run setup again without --install-deps")
        sys.exit(0 if success else 1)
    
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n❌ Setup interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {str(e)}")
        sys.exit(1)
