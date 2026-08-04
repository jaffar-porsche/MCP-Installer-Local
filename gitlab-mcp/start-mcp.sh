#!/bin/bash
set -e

echo "🦊 Starting GitLab MCP Server..."

# Function to check Python version
check_python_version() {
    local python_cmd=$1
    if command -v "$python_cmd" &> /dev/null; then
        local version=$($python_cmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
        if [ $? -eq 0 ]; then
            local major=$(echo $version | cut -d. -f1)
            local minor=$(echo $version | cut -d. -f2)
            if [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; then
                echo "$python_cmd"
                return 0
            fi
        fi
    fi
    return 1
}

# Function to detect OS
detect_os() {
    if [ -f /etc/debian_version ]; then
        echo "debian"
    elif [ -f /etc/redhat-release ]; then
        echo "redhat"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Try to find a suitable Python version
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
    if PYTHON_CMD=$(check_python_version "$cmd"); then
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Error: Python 3.10 or higher is required but not found."
    echo "Please install Python 3.10+ and try again."

    OS=$(detect_os)
    echo "💡 Installation suggestions for your system ($OS):"
    case $OS in
        "debian")
            echo "   sudo apt update && sudo apt install python3.10 python3.10-venv python3.10-pip"
            ;;
        "redhat")
            echo "   sudo yum install python310 python310-pip"
            echo "   # or: sudo dnf install python3.10 python3.10-pip"
            ;;
        "macos")
            echo "   brew install python@3.10"
            echo "   # or download from: https://www.python.org/downloads/"
            ;;
        "windows")
            echo "   Download from: https://www.python.org/downloads/"
            ;;
        *)
            echo "   Please visit: https://www.python.org/downloads/"
            ;;
    esac
    exit 1
fi

echo "✅ Using Python: $PYTHON_CMD"

# Check if we're in the correct directory
if [ ! -f "mcp_server.py" ]; then
    echo "❌ Error: mcp_server.py not found. Make sure you're in the gitlab-mcp directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found."
    if [ -f ".env.example" ]; then
        echo "📝 Copying .env.example to .env..."
        cp .env.example .env
        echo "🔧 Please edit .env file with your GitLab credentials:"
        echo "   - GITLAB_TOKEN: Your GitLab Personal Access Token"
        echo "   - GITLAB_BASE_URL: Your GitLab instance URL (default: https://cicd.skyway.porsche.com)"
        echo "   - HTTP_PROXY/HTTPS_PROXY: Proxy settings if needed"
        echo ""
        echo "To get a GitLab Personal Access Token:"
        echo "   1. Go to: https://cicd.skyway.porsche.com/-/profile/personal_access_tokens"
        echo "   2. Create a token with scopes: api, read_user, read_repository"
        echo "   3. Copy the token to the GITLAB_TOKEN variable in .env"
        echo ""
        echo "After updating .env, run this script again."
        exit 1
    else
        echo "❌ Error: .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if GitLab token is set
if ! grep -q "^GITLAB_TOKEN=" .env || grep -q "^GITLAB_TOKEN=$" .env || grep -q "^GITLAB_TOKEN=your_gitlab_personal_access_token" .env; then
    echo "❌ Error: GITLAB_TOKEN not set in .env file."
    echo "🔧 Please set your GitLab Personal Access Token in .env file:"
    echo "   GITLAB_TOKEN=glpat-your-token-here"
    echo ""
    echo "To get a GitLab Personal Access Token:"
    echo "   1. Go to: https://cicd.skyway.porsche.com/-/profile/personal_access_tokens"
    echo "   2. Create a token with scopes: api, read_user, read_repository"
    echo "   3. Copy the token to the GITLAB_TOKEN variable in .env"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment. Please check your Python installation."
        exit 1
    fi
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
python -m pip install --upgrade pip

# Install or upgrade requirements
if [ -f "requirements.txt" ]; then
    echo "📥 Installing/updating Python dependencies..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies. Please check requirements.txt and your internet connection."
        exit 1
    fi
else
    echo "❌ Error: requirements.txt not found."
    exit 1
fi

# Check if all required packages are installed
echo "🔍 Verifying installation..."
python -c "
import sys
required_packages = ['fastapi', 'fastapi_mcp', 'gitlab', 'uvicorn', 'python_dotenv', 'pydantic']
missing_packages = []

for package in required_packages:
    try:
        if package == 'python_dotenv':
            import dotenv
        elif package == 'fastapi_mcp':
            import fastapi_mcp
        else:
            __import__(package)
    except ImportError:
        missing_packages.append(package)

if missing_packages:
    print(f'❌ Missing packages: {missing_packages}')
    sys.exit(1)
else:
    print('✅ All required packages are installed')
"

if [ $? -ne 0 ]; then
    echo "❌ Package verification failed. Please check the installation."
    exit 1
fi

# Get GitLab URL from .env or use default
GITLAB_URL=$(grep "^GITLAB_BASE_URL=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
if [ -z "$GITLAB_URL" ]; then
    GITLAB_URL="https://cicd.skyway.porsche.com"
fi

# Default MCP transport if not set
if [ -z "$MCP_TRANSPORT" ]; then
    MCP_TRANSPORT="http"
fi

# Start the server
echo "🚀 Starting GitLab MCP Server..."
echo "🌐 GitLab URL: $GITLAB_URL"
echo "📡 MCP transport: $MCP_TRANSPORT"
if [ "$MCP_TRANSPORT" = "http" ]; then
    echo "🔌 MCP endpoint: http://localhost:${MCP_PORT:-8003}/mcp"
fi
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Run the MCP server
python mcp_server.py