param([switch]$StopOnFail = $false, [string]$From = "")
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $PSScriptRoot "agent_runs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$seqLog = Join-Path $logDir ("sprint_sequence_" + $ts + ".txt")
Start-Transcript -Path $seqLog -Force | Out-Null

$files = Get-ChildItem -File -Filter "SPRINT_*_PLAN.md" | Sort-Object {
  if ($_ -match 'SPRINT_(\d+)_PLAN\.md') { [int]$Matches[1] } else { 1e9 }
}, Name

if ($From) {
  $start = $files | Where-Object { $_.Name -eq $From }
  if ($start) { $idx = [array]::IndexOf($files, $start); $files = $files[$idx..($files.Count-1)] }
}

foreach ($f in $files) {
  Write-Host ("=== RUNNING {0} ===" -f $f.Name) -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\agent.ps1 -SprintFile $f.Name -Backlog "BACKLOG.md" -Config "sprint.config.yaml" -StopOnFail
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("Agent failed on {0}" -f $f.Name) -ForegroundColor Red
    if ($StopOnFail) { break }
  }
}
Stop-Transcript | Out-Null
Write-Host ("Sequence complete. Transcript: " + $seqLog) -ForegroundColor Green
