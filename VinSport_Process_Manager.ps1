param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Check", "StartLocal", "StartPublic", "StopTunnel", "Stop")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------
# VINSPORT PROCESS MANAGER
# Backend: 5000 | Frontend: 5173
# Public access: Cloudflare Quick Tunnel
# ---------------------------------------------------------

$Root = (Resolve-Path $PSScriptRoot).Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

$StateDir = Join-Path $env:LOCALAPPDATA "VinSportControlPanel"
$StateFile = Join-Path $StateDir "process-state.json"
$LogDir = Join-Path $StateDir "logs"

New-Item -ItemType Directory -Force -Path $StateDir, $LogDir | Out-Null

function New-State {
    return @{
        Mode = "Stopped"
        PublicUrl = ""
        Processes = @()
        UpdatedAt = (Get-Date).ToString("o")
    }
}

function Save-State {
    $script:State.UpdatedAt = (Get-Date).ToString("o")
    $script:State |
        ConvertTo-Json -Depth 6 |
        Set-Content -Path $StateFile -Encoding UTF8
}

function Load-State {
    if (Test-Path $StateFile) {
        try {
            return Get-Content $StateFile -Raw | ConvertFrom-Json
        }
        catch {
            Write-Warning "State file không hợp lệ. Tạo trạng thái mới."
        }
    }

    return New-State
}

$script:State = Load-State

function Test-PortAvailable {
    param([int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port `
        -State Listen -ErrorAction SilentlyContinue

    return (@($listener).Count -eq 0)
}

function Test-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $timer = [Diagnostics.Stopwatch]::StartNew()

    while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url `
                -UseBasicParsing -TimeoutSec 3

            if ($response.StatusCode -ge 200 -and
                $response.StatusCode -lt 400) {
                return $true
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

function Register-Process {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$Role
    )

    Start-Sleep -Milliseconds 200

    $item = Get-Process -Id $Process.Id -ErrorAction Stop

    $script:State.Processes += [pscustomobject]@{
        PID = [int]$Process.Id
        StartTime = $item.StartTime.ToUniversalTime().ToString("o")
        Role = $Role
    }

    Save-State
}

function Stop-ManagedProcess {
    param($Entry)

    try {
        $process = Get-Process -Id ([int]$Entry.PID) `
            -ErrorAction Stop

        $actualStart = $process.StartTime.ToUniversalTime().ToString("o")

        # Không dừng PID nếu nó đã được hệ điều hành tái sử dụng.
        if ($actualStart -ne $Entry.StartTime) {
            Write-Warning "Bỏ qua PID $($Entry.PID): không còn là tiến trình VINSPORT."
            return
        }

        & taskkill.exe /PID ([string]$Entry.PID) /T /F | Out-Null

        Write-Host "Stopped: $($Entry.Role), PID $($Entry.PID)"
    }
    catch {
        Write-Host "Process đã dừng: $($Entry.Role)"
    }
}

function Stop-Tunnel {
    $remaining = @()

    foreach ($item in $script:State.Processes) {
        if ($item.Role -eq "Cloudflare Tunnel") {
            Stop-ManagedProcess $item
        }
        else {
            $remaining += $item
        }
    }

    $script:State.Processes = $remaining
    $script:State.PublicUrl = ""
    $script:State.Mode = "Local"
    Save-State

    Write-Host "Cloudflare Tunnel stopped."
}

function Stop-VinSport {
    foreach ($item in @($script:State.Processes)) {
        Stop-ManagedProcess $item
    }

    $script:State = New-State
    Save-State

    Write-Host "VINSPORT processes stopped."
}

function Start-ManagedCommand {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string]$Role
    )

    $process = Start-Process `
        -FilePath $env:ComSpec `
        -ArgumentList "/d /s /c `"$Command`"" `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru

    Register-Process -Process $process -Role $Role

    return $process
}

function Start-Backend {
    if (-not (Test-PortAvailable 5000)) {
        throw "Port 5000 đang được sử dụng. Không tự động dừng tiến trình khác."
    }

    Write-Host "Starting Backend..."

    Start-ManagedCommand `
        -WorkingDirectory $BackendDir `
        -Command "npm.cmd run dev" `
        -Role "Backend - Nodemon"

    if (-not (Test-HttpReady "http://127.0.0.1:5000/" 90)) {
        throw "Backend chưa sẵn sàng. Kiểm tra kết nối SQL Server và Backend logs."
    }

    Write-Host "Backend ready."
}

function Start-Frontend {
    param([string]$Hostname = "")

    if (-not (Test-PortAvailable 5173)) {
        throw "Port 5173 đang được sử dụng. Không tự động dừng tiến trình khác."
    }

    Write-Host "Starting Frontend..."

    if ($Hostname) {
        if ($Hostname -notmatch '^[a-z0-9-]+\.trycloudflare\.com$') {
            throw "Hostname Quick Tunnel không hợp lệ."
        }

        $command = 'set "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=' +
            $Hostname + '" && npm.cmd run dev'
    }
    else {
        $command = 'set "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=" && npm.cmd run dev'
    }

    Start-ManagedCommand `
        -WorkingDirectory $FrontendDir `
        -Command $command `
        -Role "Frontend - Vite"

    if (-not (Test-HttpReady "http://127.0.0.1:5173/" 60)) {
        throw "Frontend chưa sẵn sàng."
    }

    Write-Host "Frontend ready."
}

function Start-CloudflareTunnel {
    Write-Host "Creating Cloudflare Quick Tunnel..."

    $cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue

    if (-not $cloudflared) {
        $cloudflared = Get-Command cloudflared -ErrorAction Stop
    }

    $stdout = Join-Path $LogDir "cloudflared-out.log"
    $stderr = Join-Path $LogDir "cloudflared-error.log"

    Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue

    $process = Start-Process `
        -FilePath $cloudflared.Source `
        -ArgumentList @("tunnel", "--url", "http://127.0.0.1:5173") `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru

    Register-Process -Process $process -Role "Cloudflare Tunnel"

    $timer = [Diagnostics.Stopwatch]::StartNew()
    $hostname = $null

    while ($timer.Elapsed.TotalSeconds -lt 60) {
        if ($process.HasExited) {
            throw "Cloudflare Tunnel đã thoát. Kiểm tra cloudflared-error.log."
        }

        $content = ""

        foreach ($file in @($stdout, $stderr)) {
            if (Test-Path $file) {
                $content += Get-Content $file -Raw -ErrorAction SilentlyContinue
            }
        }

        $match = [regex]::Match(
            $content,
            'https://[a-z0-9-]+\.trycloudflare\.com'
        )

        if ($match.Success) {
            $hostname = ([uri]$match.Value).Host
            break
        }       

        Start-Sleep -Milliseconds 500
    }

    if (-not $hostname) {
        throw "Không lấy được URL Quick Tunnel trong 60 giây."
    }

    Write-Host "Public hostname: $hostname"

    return $hostname
}

function Start-VinSport {
    param([bool]$PublicMode)

    # Dừng những tiến trình thuộc lần chạy trước của Manager.
    Stop-VinSport

    try {
        Start-Backend

        $hostname = ""
        $publicUrl = ""

        if ($PublicMode) {
            $hostname = Start-CloudflareTunnel
            $publicUrl = "https://$hostname"
        }

        Start-Frontend -Hostname $hostname

        if ($PublicMode) {
            $script:State.Mode = "Public"
            $script:State.PublicUrl = $publicUrl
        }
        else {
            $script:State.Mode = "Local"
            $script:State.PublicUrl = ""
        }

        Save-State

        Write-Host "VINSPORT READY"
        Write-Host "Mode: $($script:State.Mode)"
        Write-Host "Local URL: http://localhost:5173"

        if ($PublicMode) {
            Write-Host "Public URL: $publicUrl"
        }
    }
    catch {
        Write-Error $_
        Stop-VinSport
        throw
    }
}

switch ($Mode) {
    "Check" {
        Write-Host "VINSPORT STATUS"
        Write-Host "Mode: $($script:State.Mode)"
        Write-Host "Public URL: $($script:State.PublicUrl)"

        foreach ($item in $script:State.Processes) {
            $process = Get-Process -Id $item.PID `
                -ErrorAction SilentlyContinue

            [pscustomobject]@{
                Role = $item.Role
                PID = $item.PID
                Running = [bool]$process
            }
        }

        Write-Host "Backend HTTP:"
        Test-HttpReady "http://127.0.0.1:5000/" 2

        Write-Host "Frontend HTTP:"
        Test-HttpReady "http://127.0.0.1:5173/" 2
    }

    "StartLocal" {
        Start-VinSport -PublicMode $false
    }

    "StartPublic" {
        Start-VinSport -PublicMode $true
    }

    "StopTunnel" {
        Stop-Tunnel
    }

    "Stop" {
        Stop-VinSport
    }
}