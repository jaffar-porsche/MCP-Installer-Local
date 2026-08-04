[CmdletBinding()]
param(
    [switch] $KeepBackups
)

# Ensure consistent encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

# Paths
$DataRoot = Join-Path $env:APPDATA 'MCPorsche'

$paths = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs'),
    "C:\Users\Public\Desktop"
)

# Remove ALL MCPorsche shortcuts (robust approach)
Write-Output "Removing MCPorsche shortcuts..."

foreach ($path in $paths) {
    Get-ChildItem -Path $path -Filter "*MCPorsche*.lnk" -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Output "Removing shortcut: $($_.FullName)"
            Remove-Item -Force -ErrorAction SilentlyContinue $_.FullName
        }
}

# Remove runtime data
if ($KeepBackups) {
    Write-Output "Removing data (backups preserved): $DataRoot"
    Get-ChildItem -Path $DataRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'backups' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Output "Removing data: $DataRoot"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $DataRoot
}

Write-Output "MCPorsche uninstalled successfully."
Write-Output ".env files inside repo folders are untouched."

Write-Output "Stopping MCPorsche backend processes..."

# Kill Python processes running MCPorsche / uvicorn
Get-CimInstance Win32_Process |
Where-Object {
    $_.CommandLine -match "uvicorn" -or
    $_.CommandLine -match "mcp" -or
    $_.CommandLine -match "MCPorsche"
} |
ForEach-Object {
    Write-Output "Killing process ID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}