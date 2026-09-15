#Requires -Version 5.1
<#
.SYNOPSIS
    NEXUS — Content Operating System. Single-command orchestration for the
    local dev stack: backend (FastAPI), frontend (Next.js), automation's
    Local Runtime (FastAPI), LAB (CLI, no daemon), and Nginx (Docker).

.USAGE
    .\nexus.ps1 up | down | restart | status | logs [service] | doctor | ps

.DESIGN NOTE
    Every status check here hits a real endpoint or a real port binding --
    never a PID file or a "the folder exists" guess. down/status find
    processes by what's actually listening on the expected port, so they
    stay correct even if a service was started outside this script.
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet("up", "down", "restart", "status", "logs", "doctor", "ps", "production", "help")]
    [string]$Command = "help",

    [Parameter(Position = 1)]
    [string]$Service,

    # `production` only -- see Cmd-Production. Real deployment is NOT
    # implemented; omitting -DryRun still only prints a refusal, it never
    # falls through to doing something real.
    # (Named IncludeFrontend/ExcludeFrontend, not -Frontend/-NoFrontend,
    # on purpose: $Frontend and $Lab etc. are already script-scoped path
    # variables below -- a same-named switch parameter would silently
    # overwrite them, PowerShell variable names being case/kind-blind.
    # That exact bug already bit Cmd-Up once with $lab/$Lab; not repeating it.)
    [switch]$DryRun,
    [switch]$IncludeFrontend,
    [switch]$ExcludeFrontend,
    [string]$Provider
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Automation = Join-Path $Root "automation"
$Runtime = Join-Path $Automation "runtime"
$Lab = Join-Path $Automation "lab"
$Compose = Join-Path $Root "infrastructure\docker\docker-compose.yml"
$LogDir = Join-Path $Root ".nexus\logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

# ── colors ────────────────────────────────────────────────────────────
function C-Green($t) { Write-Host $t -ForegroundColor Green }
function C-Yellow($t) { Write-Host $t -ForegroundColor Yellow }
function C-Red($t) { Write-Host $t -ForegroundColor Red }
function C-Blue($t) { Write-Host $t -ForegroundColor Cyan }
function C-Gray($t) { Write-Host $t -ForegroundColor DarkGray }

# ── real checks — every one hits an actual endpoint/port/process ───────
function Test-Http {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{ Ok = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300); Code = $r.StatusCode; Body = $r.Content }
    } catch {
        return @{ Ok = $false; Code = $null; Body = $_.Exception.Message }
    }
}

function Get-PortOwner {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return @() }
    return $conns | Select-Object -ExpandProperty OwningProcess -Unique
}

function Test-DockerRunning {
    try {
        docker info 2>$null 1>$null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Test-LabReady {
    # lab.cli is invoked as `python -m lab.cli` from automation/ (the repo
    # root that contains the `lab` package) -- see lab/cli.py's own
    # docstring. Running it from anywhere else breaks module resolution.
    $py = Join-Path $Lab ".venv\Scripts\python.exe"
    if (-not (Test-Path $py)) { return @{ Ok = $false; Detail = "lab/.venv not found" } }
    Push-Location $Automation
    try {
        $out = & $py -m lab.cli status
        if ($LASTEXITCODE -ne 0) { return @{ Ok = $false; Detail = "lab.cli status exited $LASTEXITCODE" } }
        $json = $out -join "`n" | ConvertFrom-Json -ErrorAction Stop
        return @{ Ok = $true; Detail = "$($json.workspace.INGESTED) ingested / $($json.workspace.READY_FOR_REVIEW) ready for review" }
    } catch {
        return @{ Ok = $false; Detail = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

# Automation's legacy scraper (automation/main.py, automation/script.py)
# is deliberately NOT health-checked as a service: it has no daemon, no
# venv today, and running it has real side effects (hits live news sites,
# writes to production Supabase). Faking a check for it would violate the
# "no mocks, no fake ONLINE" rule more than just leaving it unchecked.

function Get-ServiceStatus {
    $result = [ordered]@{}

    $dockerOk = Test-DockerRunning
    $result["Docker"] = @{ Ok = $dockerOk; Detail = if ($dockerOk) { "daemon reachable" } else { "daemon not running" } }

    $backendPids = Get-PortOwner 8000
    $backendHttp = if ($backendPids.Count -gt 0) { Test-Http "http://127.0.0.1:8000/health" } else { @{ Ok = $false; Body = "port 8000 not listening" } }
    $result["Backend"] = @{ Ok = $backendHttp.Ok; Detail = if ($backendHttp.Ok) { "pid $($backendPids -join ',')" } else { $backendHttp.Body } }

    $frontendPids = Get-PortOwner 3000
    $frontendHttp = if ($frontendPids.Count -gt 0) { Test-Http "http://127.0.0.1:3000/" } else { @{ Ok = $false; Body = "port 3000 not listening" } }
    $result["Frontend"] = @{ Ok = $frontendHttp.Ok; Detail = if ($frontendHttp.Ok) { "pid $($frontendPids -join ',')" } else { $frontendHttp.Body } }

    $runtimePids = Get-PortOwner 8801
    $runtimeHttp = if ($runtimePids.Count -gt 0) { Test-Http "http://127.0.0.1:8801/status" } else { @{ Ok = $false; Body = "port 8801 not listening" } }
    $runtimeConnected = $false
    if ($runtimeHttp.Ok) {
        try { $runtimeConnected = ((ConvertFrom-Json $runtimeHttp.Body).status -eq "CONNECTED") } catch {}
    }
    $result["Automation (Runtime)"] = @{ Ok = $runtimeHttp.Ok -and $runtimeConnected; Detail = if ($runtimeHttp.Ok) { "pid $($runtimePids -join ',')" } else { $runtimeHttp.Body } }

    $labStatus = Test-LabReady
    $result["LAB"] = @{ Ok = $labStatus.Ok; Detail = $labStatus.Detail; Label = "READY" }

    # Database = real round trip through the backend to Supabase, not a
    # local container -- this project has no local DB, Supabase is remote.
    $dbCheck = if ($backendHttp.Ok) { Test-Http "http://127.0.0.1:8000/api/categories" } else { @{ Ok = $false; Body = "backend not up" } }
    $result["Database (Supabase)"] = @{ Ok = $dbCheck.Ok; Detail = if ($dbCheck.Ok) { "reachable via /api/categories" } else { $dbCheck.Body } }

    $nginxContainer = (docker ps --filter "name=nexus-nginx" --format "{{.Status}}" 2>$null)
    $nginxHttp = if ($nginxContainer) { Test-Http "http://localhost/health" } else { @{ Ok = $false; Body = "container not running" } }
    $result["Nginx"] = @{ Ok = ($nginxContainer -and $nginxHttp.Ok); Detail = if ($nginxContainer) { $nginxContainer } else { "not running" } }

    return $result
}

function Show-StatusTable {
    param($Status)
    foreach ($key in $Status.Keys) {
        $s = $Status[$key]
        $label = if ($s.Ok) { if ($s.Label) { $s.Label } else { "ONLINE" } } else { if ($s.Label) { "NOT READY" } else { "OFFLINE" } }
        $pad = $key.PadRight(22)
        if ($s.Ok) { Write-Host "[OK]   $pad " -NoNewline -ForegroundColor Green } else { Write-Host "[FAIL] $pad " -NoNewline -ForegroundColor Red }
        Write-Host "$label" -NoNewline -ForegroundColor $(if ($s.Ok) { "Green" } else { "Red" })
        Write-Host "   $($s.Detail)" -ForegroundColor DarkGray
    }
}

# ── process management (native services) ────────────────────────────────
function Start-Native {
    param([string]$Name, [string]$WorkDir, [string]$FilePath, [string[]]$ArgList, [string]$LogName)
    $out = Join-Path $LogDir "$LogName.out.log"
    $err = Join-Path $LogDir "$LogName.err.log"
    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgList -WorkingDirectory $WorkDir `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    C-Gray "  started $Name (pid $($proc.Id)) -- logs: $LogName.out.log / $LogName.err.log"
    return $proc
}

function Wait-ForPort {
    param([int]$Port, [string]$Label, [int]$TimeoutSec = 30)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        if ((Get-PortOwner $Port).Count -gt 0) { return $true }
        Start-Sleep -Seconds 1
        $elapsed++
    }
    C-Red "  $Label did not open port $Port within ${TimeoutSec}s"
    return $false
}

function Wait-ForHttp {
    # A listening port isn't "ready" for Next.js dev -- it accepts the
    # connection immediately but doesn't answer until the initial compile
    # finishes, which can take much longer than the port bind. Poll the
    # real response, not just the socket.
    param([string]$Url, [string]$Label, [int]$TimeoutSec = 45)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        if ((Test-Http $Url -TimeoutSec 5).Ok) { return $true }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    C-Red "  $Label did not answer $Url within ${TimeoutSec}s"
    return $false
}

function Cmd-Up {
    Write-Host ""
    C-Blue "===================================================="
    C-Blue "                    NEXUS"
    C-Blue "              CONTENT OPERATING SYSTEM"
    C-Blue "===================================================="
    Write-Host ""
    C-Yellow "[BOOT] Starting Nexus infrastructure..."
    Write-Host ""

    if (-not (Test-DockerRunning)) {
        C-Yellow "  Docker daemon not running -- launching Docker Desktop..."
        $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerExe) {
            Start-Process $dockerExe
            $elapsed = 0
            while (-not (Test-DockerRunning) -and $elapsed -lt 90) { Start-Sleep -Seconds 3; $elapsed += 3 }
        }
        if (Test-DockerRunning) { C-Green "  [OK]   Docker" } else { C-Red "  [FAIL] Docker -- could not start within 90s, nginx will not come up" }
    } else {
        C-Green "  [OK]   Docker"
    }

    if ((Get-PortOwner 8000).Count -eq 0) {
        Start-Native -Name "backend" -WorkDir $Backend -FilePath (Join-Path $Backend "venv\Scripts\python.exe") `
            -ArgList @("-m", "uvicorn", "app.presentation.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload") -LogName "backend" | Out-Null
        Wait-ForPort -Port 8000 -Label "Backend" | Out-Null
    }
    if ((Test-Http "http://127.0.0.1:8000/health").Ok) { C-Green "  [OK]   Backend" } else { C-Red "  [FAIL] Backend" }

    if ((Get-PortOwner 8801).Count -eq 0) {
        Start-Native -Name "runtime" -WorkDir $Runtime -FilePath (Join-Path $Runtime "venv\Scripts\python.exe") `
            -ArgList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8801") -LogName "runtime" | Out-Null
        Wait-ForPort -Port 8801 -Label "Automation (Runtime)" | Out-Null
    }
    if ((Test-Http "http://127.0.0.1:8801/status").Ok) { C-Green "  [OK]   Automation" } else { C-Red "  [FAIL] Automation" }

    if ((Get-PortOwner 3000).Count -eq 0) {
        $npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
        if (-not $npmCmd) { $npmCmd = "npm.cmd" }
        Start-Native -Name "frontend" -WorkDir $Frontend -FilePath $npmCmd -ArgList @("run", "dev") -LogName "frontend" | Out-Null
        Wait-ForPort -Port 3000 -Label "Frontend" -TimeoutSec 60 | Out-Null
    }
    if ((Wait-ForHttp "http://127.0.0.1:3000/" "Frontend" -TimeoutSec 45)) { C-Green "  [OK]   Frontend" } else { C-Red "  [FAIL] Frontend" }

    $labStatus = Test-LabReady
    if ($labStatus.Ok) { C-Green "  [OK]   LAB (ready)" } else { C-Red "  [FAIL] LAB -- $($labStatus.Detail)" }

    if (Test-DockerRunning) {
        docker compose -f $Compose up -d | ForEach-Object { C-Gray "  $_" }
        Start-Sleep -Seconds 2
        if ((Test-Http "http://localhost/health").Ok) { C-Green "  [OK]   Nginx" } else { C-Red "  [FAIL] Nginx" }
    } else {
        C-Red "  [FAIL] Nginx -- Docker not available"
    }

    Write-Host ""
    Start-Sleep -Seconds 2
    $status = Get-ServiceStatus
    $allOk = -not ($status.Values | Where-Object { -not $_.Ok })

    C-Blue "===================================================="
    if ($allOk) { C-Green "                 NEXUS ONLINE" } else { C-Yellow "                NEXUS DEGRADED" }
    C-Blue "===================================================="
    Write-Host ""
    $hostsOk = Test-NexusHost
    $base = if ($hostsOk) { "http://nexus.local" } else { "http://localhost" }
    Write-Host "Platform     -> $base"
    Write-Host "API          -> $base/api"
    Write-Host "Studio       -> $base/studio"
    Write-Host "Health       -> $base/health"
    if (-not $hostsOk) { C-Yellow "  (nexus.local not configured -- run 'nexus doctor' for the fix)" }
    Write-Host ""
    Write-Host "Services:"
    Show-StatusTable $status
    Write-Host ""
}

function Cmd-Down {
    Write-Host ""
    C-Yellow "[SHUTDOWN] Stopping Nexus infrastructure..."
    foreach ($p in @(
        @{ Port = 3000; Label = "Frontend" },
        @{ Port = 8000; Label = "Backend" },
        @{ Port = 8801; Label = "Automation (Runtime)" }
    )) {
        $procIds = Get-PortOwner $p.Port
        if ($procIds.Count -eq 0) { C-Gray "  $($p.Label): not running"; continue }
        foreach ($procId in $procIds) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                C-Yellow "  $($p.Label): stopped (pid $procId)"
            } catch { C-Red "  $($p.Label): could not stop pid ${procId}: $($_.Exception.Message)" }
        }
    }
    if (Test-DockerRunning) {
        docker compose -f $Compose down | ForEach-Object { C-Gray "  $_" }
    }
    Write-Host ""
    C-Green "NEXUS OFFLINE"
    Write-Host ""
}

function Cmd-Status {
    Write-Host ""
    C-Blue "LOCAL SERVICES"
    Write-Host ""
    Show-StatusTable (Get-ServiceStatus)
    Write-Host ""

    C-Blue "DEPLOYMENT INFORMATION"
    Write-Host ""
    $cfg = Read-DeploymentConfig
    if (-not $cfg) {
        C-Gray "  No infrastructure/deployment/deployment.yml (or .example.yml) found."
    } else {
        Write-Host "  Frontend    Provider: $(if ($cfg.FrontendEnabled) { $cfg.FrontendProvider } else { 'not enabled' })"
        Write-Host "  Backend     Provider: $(if ($cfg.BackendEnabled) { $cfg.Provider } else { 'not enabled' })"
        Write-Host "  Automation  Provider: $(if ($cfg.AutomationEnabled) { $cfg.Provider } else { 'not enabled' })"
        Write-Host "  LAB         Provider: $(if ($cfg.LabEnabled) { $cfg.Provider } else { 'not enabled' })"
        Write-Host ""
        # REACHABLE is a real HTTP check against a known live URL -- never
        # DEPLOYED, which would require real Vercel/AWS API credentials
        # this script does not have. Never conflate the two.
        $prodUrl = "https://www.nexusnews.info"
        $reach = Test-Http $prodUrl -TimeoutSec 5
        if ($reach.Ok) { C-Green "  Frontend (production URL $prodUrl): REACHABLE" }
        else { C-Yellow "  Frontend (production URL $prodUrl): NOT REACHABLE ($($reach.Body))" }
        C-Gray "  (REACHABLE = real HTTP check. This is never the same as DEPLOYED -- that would need real Vercel/AWS API credentials this script doesn't have.)"
    }
    Write-Host ""
}

function Cmd-Logs {
    param([string]$Which)
    if (-not (Test-Path $LogDir) -or (Get-ChildItem $LogDir -ErrorAction SilentlyContinue).Count -eq 0) {
        C-Yellow "No logs yet -- run 'nexus up' first."
        return
    }
    $files = if ($Which) { Get-ChildItem $LogDir -Filter "$Which.*" } else { Get-ChildItem $LogDir -Filter "*.log" }
    if ($files.Count -eq 0) { C-Yellow "No log files matching '$Which' in $LogDir"; return }
    foreach ($f in $files) {
        C-Blue "=== $($f.Name) ==="
        Get-Content $f.FullName -Tail 40
        Write-Host ""
    }
}

function Test-NexusHost {
    $hostsFile = "$env:WINDIR\System32\drivers\etc\hosts"
    if (-not (Test-Path $hostsFile)) { return $false }
    return (Select-String -Path $hostsFile -Pattern "nexus\.local" -Quiet -ErrorAction SilentlyContinue)
}

function Cmd-Doctor {
    Write-Host ""
    C-Blue "NEXUS DOCTOR"
    Write-Host ""

    C-Blue "-- Ports --"
    foreach ($p in @(80, 3000, 8000, 8801)) {
        $owners = Get-PortOwner $p
        if ($owners.Count -eq 0) { C-Green "  [OK]   port $p free" }
        else {
            $names = $owners | ForEach-Object { $ownerPid = $_; try { (Get-Process -Id $ownerPid).ProcessName } catch { "pid $ownerPid" } }
            C-Yellow "  - port $p in use by: $($names -join ', ')"
        }
    }

    Write-Host ""
    C-Blue "-- Docker --"
    if (Test-DockerRunning) { C-Green "  [OK]   daemon reachable" } else { C-Red "  [FAIL] daemon not running -- run 'nexus up' or start Docker Desktop" }

    Write-Host ""
    C-Blue "-- Env files (presence + key names only, never values) --"
    $envFiles = @(
        @{ Path = "$Backend\.env"; Keys = @("SUPABASE_SERVICE_ROLE_KEY") },
        @{ Path = "$Automation\.env"; Keys = @("SUPABASE_URL", "SUPABASE_KEY", "OPENROUTER_API_KEY") },
        @{ Path = "$Runtime\.env"; Keys = @("SUPABASE_SERVICE_ROLE_KEY") }
    )
    foreach ($e in $envFiles) {
        if (Test-Path $e.Path) {
            $content = Get-Content $e.Path -Raw
            $missing = $e.Keys | Where-Object { $content -notmatch "^$_=" -and $content -notmatch "`n$_=" }
            if ($missing.Count -eq 0) { C-Green "  [OK]   $($e.Path)" }
            else { C-Yellow "  - $($e.Path) missing: $($missing -join ', ')" }
        } else {
            C-Red "  [FAIL] $($e.Path) not found"
        }
    }

    Write-Host ""
    C-Blue "-- Dependencies --"
    $deps = @(
        @{ Label = "backend venv"; Path = "$Backend\venv\Scripts\python.exe" },
        @{ Label = "automation runtime venv"; Path = "$Runtime\venv\Scripts\python.exe" },
        @{ Label = "lab venv"; Path = "$Lab\.venv\Scripts\python.exe" },
        @{ Label = "frontend node_modules"; Path = "$Frontend\node_modules" }
    )
    foreach ($d in $deps) {
        if (Test-Path $d.Path) { C-Green "  [OK]   $($d.Label)" } else { C-Red "  [FAIL] $($d.Label) missing ($($d.Path))" }
    }
    if (-not (Test-Path "$Automation\venv") -and -not (Test-Path "$Automation\.venv")) {
        C-Yellow "  - automation/ (legacy scraper: main.py/script.py) has no venv -- deps must be installed manually, see requirements.txt"
    }

    Write-Host ""
    C-Blue "-- Database connectivity (Supabase, via backend) --"
    if ((Get-PortOwner 8000).Count -gt 0) {
        $db = Test-Http "http://127.0.0.1:8000/api/categories"
        if ($db.Ok) { C-Green "  [OK]   reachable" } else { C-Red "  [FAIL] $($db.Body)" }
    } else {
        C-Yellow "  - backend not running, can't check (run 'nexus up' first)"
    }

    Write-Host ""
    C-Blue "-- Nginx config --"
    $nginxConf = Join-Path $Root "infrastructure\docker\nginx\nginx.conf"
    if (Test-DockerRunning) {
        $test = docker run --rm -v "${nginxConf}:/etc/nginx/nginx.conf:ro" nginx:1.27-alpine nginx -t
        if ($LASTEXITCODE -eq 0) { C-Green "  [OK]   nginx.conf is valid" } else { C-Red "  [FAIL] nginx.conf invalid:`n$test" }
    } else {
        C-Yellow "  - Docker not running, can't validate nginx.conf"
    }

    Write-Host ""
    C-Blue "-- nexus.local (hosts file) --"
    if (Test-NexusHost) {
        C-Green "  [OK]   nexus.local resolves via hosts file"
    } else {
        C-Yellow "  - nexus.local is not configured. Add it yourself (needs admin):"
        Write-Host "      Add-Content -Path `"`$env:WINDIR\System32\drivers\etc\hosts`" -Value `"127.0.0.1 nexus.local`""
        Write-Host "    Or run PowerShell as Administrator and execute that line once."
        Write-Host "    Until then, http://localhost works identically (nginx listens on both)."
    }
    Write-Host ""
}

function Cmd-Ps {
    Write-Host ""
    foreach ($p in @(
        @{ Port = 8000; Label = "backend" }, @{ Port = 3000; Label = "frontend" }, @{ Port = 8801; Label = "automation-runtime" }
    )) {
        $procIds = Get-PortOwner $p.Port
        if ($procIds.Count -eq 0) { C-Gray "$($p.Label): not running" ; continue }
        foreach ($procId in $procIds) {
            try {
                $proc = Get-Process -Id $procId
                Write-Host "$($p.Label): pid $procId  ($($proc.ProcessName), started $($proc.StartTime))"
            } catch { Write-Host "$($p.Label): pid $procId" }
        }
    }
    $nginx = docker ps --filter "name=nexus-nginx" --format "{{.Names}}: {{.Status}}" 2>$null
    if ($nginx) { Write-Host $nginx } else { C-Gray "nginx: not running" }
    Write-Host ""
}

function Read-DeploymentConfig {
    # Deliberately not a general YAML parser -- infrastructure/deployment/
    # deployment.example.yml has a fixed, known, flat-ish shape (see that
    # file). A regex reader for exactly that shape is honest about what
    # it supports; pulling in a YAML module for one config file would be
    # the kind of complexity this project explicitly avoids adding
    # without a real need.
    $configPath = Join-Path $Root "infrastructure\deployment\deployment.yml"
    $usingExample = $false
    if (-not (Test-Path $configPath)) {
        $configPath = Join-Path $Root "infrastructure\deployment\deployment.example.yml"
        $usingExample = $true
    }
    if (-not (Test-Path $configPath)) { return $null }

    $text = Get-Content $configPath -Raw
    function Get-YamlScalar($pattern) {
        if ($text -match $pattern) { return $Matches[1].Trim() }
        return $null
    }

    [PSCustomObject]@{
        ConfigPath      = $configPath
        UsingExample    = $usingExample
        Environment     = Get-YamlScalar '(?m)^environment:\s*(\S+)'
        Provider        = Get-YamlScalar '(?m)^provider:\s*(\S+)'
        BackendEnabled     = (Get-YamlScalar '(?ms)^backend:\s*\n\s*enabled:\s*(\S+)') -eq 'true'
        AutomationEnabled  = (Get-YamlScalar '(?ms)^automation:\s*\n\s*enabled:\s*(\S+)') -eq 'true'
        LabEnabled         = (Get-YamlScalar '(?ms)^lab:\s*\n\s*enabled:\s*(\S+)') -eq 'true'
        FrontendEnabled    = (Get-YamlScalar '(?ms)^frontend:\s*\n\s*enabled:\s*(\S+)') -eq 'true'
        FrontendProvider   = Get-YamlScalar '(?ms)^frontend:\s*\n(?:.*\n)*?\s*provider:\s*(\S+)'
    }
}

function Cmd-Production {
    Write-Host ""
    C-Blue "===================================================="
    C-Blue "         NEXUS PRODUCTION DEPLOYMENT"
    C-Blue "===================================================="
    Write-Host ""

    $cfg = Read-DeploymentConfig
    if (-not $cfg) {
        C-Red "No deployment config found (infrastructure/deployment/deployment.yml or .example.yml)."
        return
    }
    if ($cfg.UsingExample) {
        C-Yellow "No infrastructure/deployment/deployment.yml found -- showing infrastructure/deployment/deployment.example.yml instead. Copy it to deployment.yml to customize."
        Write-Host ""
    }

    $provider = if ($Provider) { $Provider } else { $cfg.Provider }
    $wantsFrontend = $cfg.FrontendEnabled
    if ($IncludeFrontend) { $wantsFrontend = $true }
    if ($ExcludeFrontend) { $wantsFrontend = $false }

    Write-Host "Provider:"
    Write-Host "  $provider"
    Write-Host ""
    Write-Host "Components:"
    Write-Host "  $(if ($cfg.BackendEnabled) {'[YES]'} else {'[NO]'})  Backend"
    Write-Host "  $(if ($cfg.AutomationEnabled) {'[YES]'} else {'[NO]'})  Automation"
    Write-Host "  $(if ($cfg.LabEnabled) {'[YES]'} else {'[NO]'})  LAB"
    Write-Host "  $(if ($wantsFrontend) {'[YES]'} else {'[NO]'})  Frontend$(if ($wantsFrontend) {" (provider: $($cfg.FrontendProvider))"})"
    Write-Host ""
    Write-Host "Environment:"
    Write-Host "  $($cfg.Environment)"
    Write-Host ""

    C-Yellow "Risks:"
    Write-Host "  - No Terraform/CDK/CloudFormation exists in this workspace (verified 2026-09-15) -- 'aws' provider has nothing real to apply yet."
    Write-Host "  - No Dockerfile exists for backend/automation/lab -- nothing to build an AWS image from yet."
    Write-Host "  - No CI/CD pipeline deploys this repo anywhere except Vercel's own GitHub integration for frontend/ (unverified from this machine whether it's actually connected)."
    Write-Host ""

    if (-not $DryRun) {
        C-Red "Real deployment is NOT implemented. Only 'nexus production -DryRun' is supported today."
        C-Red "This command has made NO changes and will not proceed further."
        Write-Host "See docs/NEXUS_DEPLOYMENT_ARCHITECTURE.md for what's missing before this can deploy anything real."
        return
    }

    C-Green "DRY RUN complete -- no changes were made."
}

function Cmd-Help {
    Write-Host @"
NEXUS -- Content Operating System

Usage: .\nexus.ps1 <command>

Commands:
  up        Start backend, frontend, automation runtime, LAB check, nginx
            (LOCAL DEVELOPMENT ONLY -- never deploys anything)
  down      Stop everything (by real port ownership, not a pid file)
  restart   down, then up
  status    Print real health of every service (no starting)
  logs [service]   Tail logs (backend|frontend|runtime), or all if omitted
  doctor    Diagnose ports, Docker, env files, deps, DB, nginx, hosts
  ps        List managed processes with real pid/status
  production [-DryRun] [-IncludeFrontend|-ExcludeFrontend] [-Provider x]
            Show the PRODUCTION deployment plan (provider/components/
            risks) from infrastructure/deployment/deployment.yml.
            Real deployment is NOT implemented -- only -DryRun is
            supported; without it, this prints the plan and refuses to
            proceed. Never confuse this with 'up' -- 'up' starts your
            local dev environment, 'production' is about deploying.
"@
}

switch ($Command) {
    "up" { Cmd-Up }
    "down" { Cmd-Down }
    "restart" { Cmd-Down; Start-Sleep -Seconds 2; Cmd-Up }
    "status" { Cmd-Status }
    "logs" { Cmd-Logs -Which $Service }
    "doctor" { Cmd-Doctor }
    "ps" { Cmd-Ps }
    "production" { Cmd-Production }
    default { Cmd-Help }
}
