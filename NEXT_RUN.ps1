$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $PSScriptRoot "agent_runs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$log = Join-Path $logDir ("overnight_" + $ts + ".log")

# Chain the full run + preview; tee output to a log
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_AND_PREVIEW.ps1 2>&1 | Tee-Object -FilePath $log
if ($LASTEXITCODE -ne 0) { throw "NEXT_RUN failed with exit $LASTEXITCODE" }

Write-Host ("NEXT_RUN complete. Log: " + $log) -ForegroundColor Green

