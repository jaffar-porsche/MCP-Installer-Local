#requires -Version 5.1
<#
    Build the MCP-Installer installer with corporate-AV cache-race recovery.

    Corporate AV / EDR (Defender + Zscaler + CrowdStrike, etc.) intermittently
    denies the atomic rename electron-builder needs to promote a downloaded
    NSIS package (`<tempNumeric>` -> `nsis-3.0.4.1` / `nsis-resources-3.4.1`).
    This script wraps `npm run build:win`, watches the cache, and performs the
    rename ourselves once AV releases the handle.

    Usage:
        cd deliverable-electron
        pwsh -File .\scripts\build.ps1
#>

$ErrorActionPreference = 'Stop'

$CachePath = 'C:\eb-cache'
$env:ELECTRON_BUILDER_CACHE = $CachePath
New-Item -ItemType Directory -Force -Path (Join-Path $CachePath 'nsis') | Out-Null

function Repair-NsisCache {
    Start-Sleep -Seconds 2
    $nsisDir = Join-Path $CachePath 'nsis'
    Get-ChildItem $nsisDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch '^nsis(-|\.)' } |
        ForEach-Object {
            $target = if (Test-Path (Join-Path $_.FullName 'Plugins')) {
                Join-Path $nsisDir 'nsis-resources-3.4.1'
            } else {
                Join-Path $nsisDir 'nsis-3.0.4.1'
            }
            if (Test-Path $target) { Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue }
            Write-Host "  ↺ recovering $($_.Name) -> $(Split-Path $target -Leaf)" -ForegroundColor Yellow
            try { Move-Item $_.FullName $target -Force -ErrorAction Stop }
            catch { Write-Host "  ⚠ move failed: $($_.Exception.Message)" -ForegroundColor Red }
        }
}

$maxAttempts = 3
for ($i = 1; $i -le $maxAttempts; $i++) {
    Write-Host "`n=== Build attempt $i / $maxAttempts ===" -ForegroundColor Cyan
    Remove-Item -Recurse -Force (Join-Path $PSScriptRoot '..\dist') -ErrorAction SilentlyContinue

    npm run build:win
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✔ Build succeeded — installer at deliverable-electron\dist\" -ForegroundColor Green
        Get-ChildItem (Join-Path $PSScriptRoot '..\dist') -Filter '*.exe' |
            Select-Object Name, @{n='SizeMB';e={[math]::Round($_.Length/1MB,1)}}
        exit 0
    }

    Write-Host "`n✘ Build failed (exit $LASTEXITCODE). Attempting cache repair…" -ForegroundColor Yellow
    Repair-NsisCache
}

Write-Host "`n✘ All $maxAttempts build attempts failed. See output above." -ForegroundColor Red
exit 1
