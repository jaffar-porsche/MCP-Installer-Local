# --- MCPorsche Install Script (Clean + Fixed) ---

$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $Here
$DataRoot = Join-Path $env:APPDATA 'MCPorsche'
$LogDir = Join-Path $DataRoot 'logs'
$InstallLog = Join-Path $LogDir 'install.log'

New-Item -ItemType Directory -Force -Path $DataRoot, $LogDir | Out-Null

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------

function Write-Log {
    param([string] $Message, [string] $Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "$ts [$Level] $Message"
    Write-Host $line
    Add-Content -Path $InstallLog -Value $line
}

function Write-Section {
    param([string] $Title)
    Write-Host ''
    Write-Host ('=' * 60) -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host ('=' * 60) -ForegroundColor Cyan
    Write-Log "-- $Title --"
}

# ---------------------------------------------------------------------------
# PYTHON DETECTION
# ---------------------------------------------------------------------------

function Get-Python {
    foreach ($cmd in @('py', 'python', 'python3')) {
        try {
            $ver = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0 -and $ver -match 'Python (\d+)\.(\d+)') {
                if ([int]$Matches[1] -ge 3 -and [int]$Matches[2] -ge 10) {
                    return $cmd
                }
            }
        } catch {}
    }
    return $null
}

Write-Section 'Detecting Python'

$PythonCmd = Get-Python
if (-not $PythonCmd) {
    throw 'Python 3.10+ required.'
}

# ---------------------------------------------------------------------------
# VENV SELF-HEALING
# ---------------------------------------------------------------------------

function Ensure-Venv {
    param(
        [string] $Path,
        [string] $Name
    )

    $py = Join-Path $Path 'Scripts\python.exe'
    $cfg = Join-Path $Path 'pyvenv.cfg'

    $recreate = $false

    if (!(Test-Path $py)) {
        Write-Log "$Name venv missing python.exe → creating"
        $recreate = $true
    }
    elseif (!(Test-Path $cfg)) {
        Write-Log "$Name venv broken (missing pyvenv.cfg) → recreating" 'WARN'
        $recreate = $true
    }

    if ($recreate) {
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $Path
        & $PythonCmd -m venv $Path *>> $InstallLog

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create venv for $Name"
        }
    }

    return $py
}

# ---------------------------------------------------------------------------
# SERVER INSTALL
# ---------------------------------------------------------------------------

function Install-ServerVenv {
    param([string] $ServerKey)

    $dir = Join-Path $RepoRoot "$ServerKey-mcp"
    if (!(Test-Path $dir)) {
        Write-Log "$ServerKey missing, skipping" 'WARN'
        return
    }

    Write-Section "Installing $ServerKey MCP"

    $venvDir = Join-Path $dir 'venv'
    $python = Ensure-Venv -Path $venvDir -Name $ServerKey

    Write-Log "Upgrading pip ($ServerKey)"
    & $python -m pip install --upgrade pip *>> $InstallLog

    $req = Join-Path $dir 'requirements.txt'
    if (Test-Path $req) {
        Write-Log "Installing deps ($ServerKey)"
        & $python -m pip install -r $req *>> $InstallLog
    }
}

foreach ($s in $Servers) {
    Install-ServerVenv $s
}

# ---------------------------------------------------------------------------
# TRAY / RUNTIME
# ---------------------------------------------------------------------------

Write-Section 'Setting up tray & wizard runtime'

$TrayVenv = Join-Path $DataRoot 'runtime-venv'
$TrayPython = Ensure-Venv -Path $TrayVenv -Name 'runtime'

Write-Log "Upgrading pip (runtime)"
& $TrayPython -m pip install --upgrade pip *>> $InstallLog

$trayReq = Join-Path $Here 'mcporsche_setup\requirements.txt'

if (Test-Path $trayReq) {
    Write-Log "Installing tray deps"
    & $TrayPython -m pip install -r $trayReq *>> $InstallLog
} else {
    Write-Log "Missing tray requirements.txt" 'WARN'
}

# ---------------------------------------------------------------------------
# INTEGRATION
# ---------------------------------------------------------------------------

Write-Section 'Registering endpoints'

Push-Location $Here
try {
    & $TrayPython -m mcporsche_setup integrate --servers @Servers
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# SHORTCUT (NO CMD)
# ---------------------------------------------------------------------------

Write-Section 'Creating Start Menu shortcut'

$startMenu = [Environment]::GetFolderPath('Programs')
$shortcut = Join-Path $startMenu 'MCPorsche Control Panel.lnk'

$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut($shortcut)

$pythonw = $TrayPython -replace 'python.exe', 'pythonw.exe'

$lnk.TargetPath = $pythonw
$lnk.Arguments = '-m mcporsche_setup panel'
$lnk.WorkingDirectory = $Here
$lnk.Save()

Write-Log "Shortcut created: $shortcut"

# ---------------------------------------------------------------------------
# WIZARD (NO CMD WINDOW)
# ---------------------------------------------------------------------------

if (-not $SkipWizard) {
    Write-Section 'Launching Wizard'

    $pythonw = $TrayPython -replace 'python.exe', 'pythonw.exe'

    Start-Process -FilePath $pythonw `
        -ArgumentList "-m mcporsche_setup configure" `
        -WorkingDirectory $Here

    Start-Sleep -Milliseconds 500
}

# ---------------------------------------------------------------------------
# DONE
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "MCPorsche install complete." -ForegroundColor Green
Write-Host "Data: $DataRoot"