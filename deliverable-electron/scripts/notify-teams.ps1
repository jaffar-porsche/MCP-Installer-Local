#requires -Version 5.1

param(
    [string]$WebhookUrl = $env:TEAMS_WEBHOOK_URL,
    [string]$ReleaseUrl = $env:MCP_INSTALLER_RELEASE_URL,
    [string]$Version
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WebhookUrl)) {
    throw 'Set TEAMS_WEBHOOK_URL or pass -WebhookUrl before sending a Teams notification.'
}

$packageJsonPath = Join-Path $PSScriptRoot '..\package.json'
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = [string]$packageJson.version
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw 'Could not determine the app version from package.json.'
}

$displayVersion = if ($Version.StartsWith('v')) { $Version } else { "v$Version" }

if ([string]::IsNullOrWhiteSpace($ReleaseUrl)) {
    $ReleaseUrl = 'https://github.com/porsche-code/MCP-Installer/releases/latest'
}

$payload = @{
    text = "MCP Installer $displayVersion released`nDownload: $ReleaseUrl"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $payload -ContentType 'application/json' | Out-Null
Write-Host "Teams notification sent for MCP Installer $displayVersion" -ForegroundColor Green