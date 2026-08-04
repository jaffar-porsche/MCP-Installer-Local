<#
.SYNOPSIS
    Build a single-file MCPorsche.exe using PyInstaller.

.DESCRIPTION
    Bundles the mcporsche_setup package (wizard + launcher + tray) into
    dist/MCPorsche.exe. The .exe still needs the jira-mcp / confluence-mcp /
    gitlab-mcp source trees to sit next to it, because those Python servers
    each have their own venv managed by install.ps1.

    Run inside the deliverable runtime venv:
        %APPDATA%\MCPorsche\runtime-venv\Scripts\Activate.ps1
        pip install pyinstaller
        .\build\build_exe.ps1
#>
[CmdletBinding()]
param(
    [string] $OutDir = 'dist',
    [switch] $Windowed
)

$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Deliverable = Split-Path -Parent $Here
Push-Location $Deliverable
try {
    if (-not (Get-Command pyinstaller -ErrorAction SilentlyContinue)) {
        throw "pyinstaller not installed. Run: pip install pyinstaller"
    }
    $args = @(
        '--onefile',
        '--name', 'MCPorsche',
        '--distpath', $OutDir,
        '--workpath', 'build\pyi-work',
        '--specpath', 'build',
        '--collect-submodules', 'mcporsche_setup',
        '--paths', $Deliverable
    )
    if ($Windowed) { $args += '--noconsole' }
    $args += 'mcporsche_setup\__main__.py'

    Write-Host "pyinstaller $($args -join ' ')" -ForegroundColor Cyan
    pyinstaller @args
    Write-Host "Built: $Deliverable\$OutDir\MCPorsche.exe" -ForegroundColor Green
} finally {
    Pop-Location
}
