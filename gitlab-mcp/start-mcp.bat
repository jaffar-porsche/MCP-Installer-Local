@echo off
echo.
echo  ========================================
echo   GITLAB MCP SERVER
echo  ========================================
echo.

REM Check if we're in the correct directory
if not exist "mcp_server.py" (
    echo  [X] ERROR: mcp_server.py not found. Make sure you're in the gitlab-mcp directory.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo  [!] WARNING: .env file not found.
    if exist ".env.example" (
        echo  [i] Copying .env.example to .env...
        copy ".env.example" ".env"
        echo  [*] Please edit .env file with your GitLab credentials:
        echo       - GITLAB_TOKEN: Your GitLab Personal Access Token
        echo       - GITLAB_BASE_URL: Your GitLab instance URL
        echo       - HTTP_PROXY/HTTPS_PROXY: Proxy settings if needed
        echo.
        echo  To get a GitLab Personal Access Token:
        echo       1. Go to: https://cicd.skyway.porsche.com/-/profile/personal_access_tokens
        echo       2. Create a token with scopes: api, read_user, read_repository
        echo       3. Copy the token to the GITLAB_TOKEN variable in .env
        echo.
        echo  After updating .env, run this script again.
        pause
        exit /b 1
    ) else (
        echo  [X] ERROR: .env.example not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

REM Check if GitLab token is set
findstr /b "GITLAB_TOKEN=" .env | findstr /v "GITLAB_TOKEN=$" | findstr /v "GITLAB_TOKEN=your_gitlab_personal_access_token" >nul
if errorlevel 1 (
    echo  [X] ERROR: GITLAB_TOKEN not set in .env file.
    echo  [*] Please set your GitLab Personal Access Token in .env file:
    echo       GITLAB_TOKEN=glpat-your-token-here
    echo.
    echo  To get a GitLab Personal Access Token:
    echo       1. Go to: https://cicd.skyway.porsche.com/-/profile/personal_access_tokens
    echo       2. Create a token with scopes: api, read_user, read_repository
    echo       3. Copy the token to the GITLAB_TOKEN variable in .env
    pause
    exit /b 1
)

REM Try to find Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [X] ERROR: Python is not installed or not in PATH.
    echo  [?] Please install Python 3.10 or higher from: https://www.python.org/downloads/
    echo       Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo  [+] Python found
python --version

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo  [i] Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo  [X] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo  [i] Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo  [^] Upgrading pip...
python -m pip install --upgrade pip --proxy http-proxy.porsche.org:3133

REM Install or upgrade requirements
if exist "requirements.txt" (
    echo  [v] Installing/updating Python dependencies...
    pip install -r requirements.txt --proxy http-proxy.porsche.org:3133
    if errorlevel 1 (
        echo  [X] Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo  [X] ERROR: requirements.txt not found.
    pause
    exit /b 1
)

REM Check if all required packages are installed
echo  [~] Verifying installation...
python -c "import sys; import fastapi, fastapi_mcp, gitlab, uvicorn, dotenv, pydantic; print(' [+] All required packages are installed')"
if errorlevel 1 (
    echo  [X] Package verification failed.
    pause
    exit /b 1
)

REM Default MCP transport if not set
if "%MCP_TRANSPORT%"=="" set MCP_TRANSPORT=http

REM Start the server
echo.
echo  ----------------------------------------
echo  [^>] STARTING GITLAB MCP SERVER...
echo  ----------------------------------------
echo  [i] MCP transport: %MCP_TRANSPORT%
if /I "%MCP_TRANSPORT%"=="http" (
    echo  [i] MCP endpoint: http://localhost:%MCP_PORT%/mcp
)
echo  [!] Press Ctrl+C to stop the server
echo.

REM Run the MCP server
python mcp_server.py