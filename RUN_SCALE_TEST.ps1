param([string]$ConfigPath=".\\config\\scale.json",[switch]$Serve=$true)
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$OrgId = $cfg.orgId
$Vehicles = @($cfg.vehicles)
$Clips = [int]$cfg.clipsPerVehicle
$Port = [int]$cfg.servePort
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path ".\\agent_runs" ("scale_run_"+$ts+".txt")
Start-Transcript -Path $log -Force | Out-Null
try {
  Write-Host "=== Assemble frontend ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\assemble.ps1

  Write-Host "=== Deploy rules/functions/hosting ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-all.ps1

  Write-Host ("=== Bulk seed "+$Vehicles.Count+" vehicles ? "+$Clips+" clips ===") -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ingest\BULK_SEED.ps1 -OrgId $OrgId -Vehicles $Vehicles -ClipsPerVehicle $Clips -MakePlaceholders

  Write-Host "=== Bulk ingest ? upload & rebuild manifests ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ingest\BULK_INGEST.ps1 -OrgId $OrgId -Vehicles $Vehicles

  Write-Host "=== Verify catalog ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\VERIFY_CATALOG.ps1 -OrgId $OrgId -OutPath ".\agent_runs\catalog_"+$ts+".json"

  if ($Serve -and (Test-Path ".\app\web-dist")) {
    Start-Process cmd "/c npx http-server `".\app\web-dist`" -p $Port -c-1" -WindowStyle Hidden
    Start-Sleep 3
    Start-Process ("http://localhost:{0}" -f $Port)
  }

  # Agent ON + watcher + one full pass
  "on"   | Set-Content .\AGENT_MODE.flag -Encoding ascii
  "FIFO" | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
  $running = Get-Process powershell -ErrorAction SilentlyContinue | ? { $_.Path -match "RUN_AGENT_MODE\.ps1" }
  if (-not $running) { Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File .\RUN_AGENT_MODE.ps1 -Minutes 5" -WindowStyle Minimized }
  powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -StopOnFail
} finally {
  Stop-Transcript | Out-Null
  Write-Host ("Scale run log: "+$log) -ForegroundColor Green
}
