<#
.DEPRECATED (2026-09-15)
  This exact migration already happened, by a different (safer) method:
  Desktop/news is now Desktop/NEXUS, and Desktop/RPA_NEWS_SCRIPT is now
  NEXUS/automation. This script targeted Desktop/creation-advanced and a
  `rpa/` name that were never actually used, and moving whole directories
  turned out to be blocked on this machine by the running session itself
  holding them as a working directory -- the actual migration moved each
  top-level item individually instead (see git log / obsidian-vault/
  Roadmap.md for the real steps taken). Kept here for history, not as
  something to run again -- DEPRECATE, not delete, per this project's own
  rule against removing code without evidence it's unused.

.SYNOPSIS
  Relocates the CRONOS workspace from Desktop/news + Desktop/RPA into
  Desktop/creation-advanced/{frontend,backend,infrastructure,rpa}.

.NOTES
  Run this OUTSIDE any live Claude Code session rooted at Desktop/news —
  moving that directory out from under an active session's working
  directory can break the session mid-operation. Close editors/dev servers
  that hold files open in Desktop/news or Desktop/RPA before running this.

  frontend/, backend/, infrastructure/ and obsidian-vault/ already live at
  the root of Desktop/news (this was done in-session, see git log), so this
  script only needs to rename the top-level folder and fold RPA in as a
  sibling — no internal restructuring left to do here.

.USAGE
  powershell -ExecutionPolicy Bypass -File migrate-workspace.ps1
#>

$ErrorActionPreference = "Stop"

$Desktop = [Environment]::GetFolderPath("Desktop")
$Source  = Join-Path $Desktop "news"
$Rpa     = Join-Path $Desktop "RPA"
$Target  = Join-Path $Desktop "creation-advanced"

Write-Host "== CRONOS workspace migration ==" -ForegroundColor Cyan

if (-not (Test-Path $Source)) {
    throw "Source not found: $Source — nothing to migrate."
}
if (Test-Path $Target) {
    throw "Target already exists: $Target — aborting to avoid overwriting. Remove or rename it first if this is intentional."
}

# Safety: refuse to move a git repo with uncommitted changes.
Push-Location $Source
try {
    $dirty = git status --porcelain 2>$null
    if ($LASTEXITCODE -eq 0 -and $dirty) {
        throw "Desktop/news has uncommitted git changes. Commit or stash them first:`n$dirty"
    }
} finally {
    Pop-Location
}

Write-Host "Moving $Source -> $Target ..."
Move-Item -Path $Source -Destination $Target

if (Test-Path $Rpa) {
    Write-Host "Moving $Rpa -> $Target\rpa ..."
    Move-Item -Path $Rpa -Destination (Join-Path $Target "rpa")

    $rpaVenv = Join-Path $Target "rpa\venv"
    if (Test-Path $rpaVenv) {
        Write-Host "Removing rpa/venv (baked absolute paths, must be recreated at the new location) ..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $rpaVenv
    }
} else {
    Write-Host "No Desktop/RPA folder found — skipping rpa/ migration." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== Done ==" -ForegroundColor Green
Write-Host "Workspace is now at: $Target"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start a new Claude Code / editor session rooted at $Target"
Write-Host "  2. cd rpa; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt"
Write-Host "  3. Verify frontend (cd frontend; npm install; npm run build) and backend (cd backend; .\venv\Scripts\python -m pytest) still work from the new path"
