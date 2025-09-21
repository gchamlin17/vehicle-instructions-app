param(
  [string]$OrgId="household:test",
  [string]$Vehicle="honda/cr-v/2020/ex",
  [switch]$Serve=$true,
  [int]$Port=5173
)
$ErrorActionPreference="Stop"; Set-Location $PSScriptRoot
function Sanitize-Part([string]$s){ return ($s -replace '[:*?"<>|]', '_') }

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path ".\agent_runs" ("ingest_demo_"+$ts+".txt")
Start-Transcript -Path $log -Force | Out-Null

try {
  # Build + deploy everything
  powershell -NoProfile -ExecutionPolicy Bypass -File .\assemble.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-all.ps1

  # Build colon-safe local sample path: .\data\sample_videos\<orgLocal>\<vehicleLocal\...\>
  $orgLocal = Sanitize-Part $OrgId
  $vehParts = ($Vehicle -replace '\\','/') -split '/'
  $base = Join-Path ".\data\sample_videos" $orgLocal
  foreach($p in $vehParts){ $base = Join-Path $base (Sanitize-Part $p) }

  if (!(Test-Path (Join-Path $base "videos"))) {
    New-Item -ItemType Directory -Force -Path (Join-Path $base "videos"), (Join-Path $base "captions") | Out-Null
    "WEBVTT`n`n00:00.000 --> 00:02.000`nSample caption" | Set-Content (Join-Path $base "captions\tpms-reset.vtt") -Encoding ascii
    # (optional) place a small MP4 at: $base\videos\tpms-reset.mp4
  }

  # Upload & trigger manifest rebuild (uses cloud-safe raw IDs)
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ingest\QUEUE_AND_PROCESS.ps1 -OrgId $OrgId -Vehicle $Vehicle

  # Serve UI if available
  if ($Serve -and (Test-Path ".\app\web-dist")) {
    Start-Process cmd "/c npx http-server `".\app\web-dist`" -p $Port -c-1" -WindowStyle Hidden
    Start-Sleep 3
    Start-Process ("http://localhost:{0}" -f $Port)
  }
}
finally {
  Stop-Transcript | Out-Null
  Write-Host ("Ingest demo log: "+$log) -ForegroundColor Green
}
