param([switch]$Serve=$true,[int]$Port=5173)
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path ".\agent_runs" ("run_now_"+$ts+".txt")
Start-Transcript -Path $log -Force | Out-Null

try {
  powershell -NoProfile -ExecutionPolicy Bypass -File .\HEALTH.ps1

  Write-Host "=== Assemble ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\assemble.ps1

  Write-Host "=== Deploy All (Rules/Functions/Hosting) ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-all.ps1

  if ($Serve -and (Test-Path ".\app\web-dist")) {
    Start-Process cmd "/c npx http-server `".\app\web-dist`" -p $Port -c-1" -WindowStyle Hidden
    Start-Sleep 3
    Start-Process ("http://localhost:{0}" -f $Port)
  }

  Write-Host "=== Agent: run-once (quota-aware) ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\AGENT_CONTROL.ps1 run-once

  . .\scripts\lib\Notify.ps1 -Title "VI Agent ? Run complete" -Message ("Transcript: "+$log) -Level "ok"
} catch {
  . .\scripts\lib\Notify.ps1 -Title "VI Agent ? Run FAILED" -Message $_.Exception.Message -Level "err"
  powershell -NoProfile -ExecutionPolicy Bypass -File .\TRIAGE.ps1 -Reason $_.Exception.Message
  throw
} finally {
  Stop-Transcript | Out-Null
}
