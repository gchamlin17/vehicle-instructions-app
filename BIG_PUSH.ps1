param([switch]$Serve=$true,[int]$Port=5173,[switch]$StopOnFail=$false)
$ErrorActionPreference="Stop"; Set-Location $PSScriptRoot
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path .\agent_runs ("bigpush_"+$ts+".txt")
Start-Transcript -Path $log -Force | Out-Null
Write-Host "=== Build Frontend ===" -ForegroundColor Cyan
powershell -NoProfile -ExecutionPolicy Bypass -File .\assemble.ps1
Write-Host "=== Deploy All (Functions/Rules/Hosting) ===" -ForegroundColor Cyan
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-all.ps1
if ($Serve -and (Test-Path ".\app\web-dist")) {
  Start-Process cmd "/c npx http-server `".\app\web-dist`" -p $Port -c-1" -WindowStyle Hidden
  Start-Sleep 3
  Start-Process ("http://localhost:{0}" -f $Port)
}
Write-Host "=== Agent Mode Kick (loop watcher) ===" -ForegroundColor Cyan
# Ensure Agent Mode ON; FIFO run; then loop watcher takes over
"on"  | Set-Content .\AGENT_MODE.flag -Encoding ascii
"FIFO" | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File .\RUN_AGENT_MODE.ps1" -WindowStyle Minimized
Stop-Transcript | Out-Null
Write-Host ("Big push complete. Transcript: " + $log) -ForegroundColor Green
