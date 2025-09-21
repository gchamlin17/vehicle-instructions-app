$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $PSScriptRoot "agent_runs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$transcript = Join-Path $logDir ("transcript_sprint4_" + $ts + ".txt")
Start-Transcript -Path $transcript -Force | Out-Null
powershell -NoProfile -ExecutionPolicy Bypass -File .\agent.ps1 -SprintFile "SPRINT_4_PLAN.md" -Backlog "BACKLOG.md" -Config "sprint.config.yaml" -StopOnFail
Stop-Transcript | Out-Null
Write-Host ("Sprint 4 run complete. Transcript: " + $transcript) -ForegroundColor Green
