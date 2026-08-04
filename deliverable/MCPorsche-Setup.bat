@echo off
REM MCPorsche one-click installer.
REM Double-click me. That's it.

setlocal
set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1" %*
if errorlevel 1 (
    echo.
    echo Installation encountered an error. See the log above.
    pause
)
endlocal
