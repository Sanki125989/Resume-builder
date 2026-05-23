# ──────────────────────────────────────────────────────────────────────────────
# run-resume-upload.ps1
# Automates: Start Services → Login Naukri → update resume → upload → Kill Services
# Designed for Windows Task Scheduler
# ──────────────────────────────────────────────────────────────────────────────

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$WORKSPACE = $PSScriptRoot
$BACKEND_DIR = Join-Path $WORKSPACE "resume-builder\backend"
$PUPPETEER_DIR = Join-Path $WORKSPACE "resume-builder\puppeteer-service"
$ENV_FILE = Join-Path $WORKSPACE ".env"
$LOGFILE = Join-Path $WORKSPACE "resume-upload-ps.log"

# Helper for logging
function Log-Message($Msg) {
    $timestamp = Get-Date -Format "dd-MM-yyyy HH:mm:ss"
    $line = "[$timestamp] $Msg"
    Write-Output $line
    Add-Content -Path $LOGFILE -Value $line
}

# Helper to show auto-closing notifications (so Task Scheduler doesn't hang)
function Show-Notification($Title, $Message, $IsError = $false) {
    try {
        $wsh = New-Object -ComObject Wscript.Shell
        $icon = if ($IsError) { 0x10 } else { 0x40 } # 0x10 = Critical, 0x40 = Info
        # Popup closes automatically after 10 seconds
        $wsh.Popup($Message, 10, $Title, $icon) | Out-Null
    } catch {
        Log-Message "Failed to display toast notification: $_"
    }
}

# Helper to check if a port is listening
function Test-PortListening($Port) {
    $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Helper to kill any process listening on a specific port
function Stop-ProcessOnPort($Port) {
    $netstat = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s"
    if ($netstat) {
        foreach ($line in $netstat) {
            $parts = $line.line.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
            $pid = $parts[-1]
            if ($pid -match '^\d+$' -and $pid -gt 0) {
                Log-Message "Terminating process $pid listening on port $Port..."
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Log-Message "════════════════════════════════════════════════════════"
Log-Message "Resume Upload Job STARTED"

# Load environment variables
if (-not (Test-Path $ENV_FILE)) {
    Log-Message "ERROR: .env not found at $ENV_FILE"
    Show-Notification "Resume Builder Error" "ERROR: .env not found at $ENV_FILE" $true
    exit 1
}

# Read env variables manually
Get-Content $ENV_FILE | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $key, $value = $line.Split("=", 2)
        $key = $key.Trim()
        $value = $value.Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($key, $value)
    }
}

$NAUKRI_EMAIL = [System.Environment]::GetEnvironmentVariable("NAUKRI_EMAIL")
$NAUKRI_PASSWORD = [System.Environment]::GetEnvironmentVariable("NAUKRI_PASSWORD")

if ([string]::IsNullOrEmpty($NAUKRI_EMAIL) -or [string]::IsNullOrEmpty($NAUKRI_PASSWORD)) {
    Log-Message "ERROR: NAUKRI_EMAIL or NAUKRI_PASSWORD not set in env variables"
    Show-Notification "Resume Builder Error" "ERROR: NAUKRI_EMAIL or NAUKRI_PASSWORD not set in env variables" $true
    exit 1
}

# Tracks processes launched in this run to kill them at the end
$StartedPuppeteer = $false
$StartedBackend = $false

try {
    # ── Start Puppeteer service (port 3001) ──────────────────────────────────
    if (Test-PortListening 3001) {
        Log-Message "Puppeteer service already running on :3001"
    } else {
        Log-Message "Starting Puppeteer service..."
        if (-not (Test-Path (Join-Path $PUPPETEER_DIR "dist\index.js"))) {
            Log-Message "  Building Puppeteer service (first run)..."
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build" -WorkingDirectory $PUPPETEER_DIR -NoNewWindow -Wait
        }
        
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory $PUPPETEER_DIR -NoNewWindow
        $StartedPuppeteer = $true
        
        # Wait up to 15s
        for ($i = 0; $i -lt 5; $i++) {
            Start-Sleep -Seconds 3
            if (Test-PortListening 3001) {
                Log-Message "  Puppeteer service ready"
                break
            }
        }
    }

    # ── Start Spring Boot backend (port 8085) ───────────────────────────────
    if (Test-PortListening 8085) {
        Log-Message "Backend already running on :8085"
    } else {
        Log-Message "Starting Spring Boot backend (takes ~45s)..."
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvn spring-boot:run" -WorkingDirectory $BACKEND_DIR -NoNewWindow
        $StartedBackend = $true

        # Wait up to 90s
        $ready = $false
        for ($i = 0; $i -lt 18; $i++) {
            Start-Sleep -Seconds 5
            if (Test-PortListening 8085) {
                Log-Message "  Backend ready after $($i * 5) seconds"
                $ready = $true
                break
            }
            Log-Message "  ...waiting for backend ($($i * 5)s elapsed)"
        }

        if (-not $ready) {
            throw "Backend did not start within 90s — aborting"
        }
    }

    # ── Call the API ──────────────────────────────────────────────────────────
    Log-Message "Calling POST /api/login-and-upload-resume..."
    $Headers = @{ "Content-Type" = "application/json" }
    $Body = @{
        username = $NAUKRI_EMAIL
        password = $NAUKRI_PASSWORD
    } | ConvertTo-Json

    # Set long timeout for compilation and Puppeteer automation
    $Response = Invoke-RestMethod -Uri "http://localhost:8085/api/login-and-upload-resume" -Method Post -Headers $Headers -Body $Body -TimeoutSec 600

    Log-Message "Response: $($Response | ConvertTo-Json -Compress)"

    if ($Response.success -eq $true) {
        Log-Message "SUCCESS — PDF: $($Response.pdfPath)"
        Show-Notification "Resume Builder Success" "Naukri resume successfully updated and uploaded!"
    } else {
        throw "Failed resume upload: $($Response.message)"
    }

} catch {
    Log-Message "ERROR OCCURRED: $_"
    Show-Notification "Resume Builder Failure" "Automation failed! Error: $_" $true
    exit 1
} finally {
    # ── Teardown Services (PC should sleep cleanly) ───────────────────────────
    Log-Message "Cleaning up background services..."
    if ($StartedPuppeteer) {
        Stop-ProcessOnPort 3001
    }
    if ($StartedBackend) {
        Stop-ProcessOnPort 8085
    }
    Log-Message "Resume Upload Job COMPLETE"
    Log-Message "════════════════════════════════════════════════════════"
}
