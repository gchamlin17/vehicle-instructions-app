param(
  [string[]]$Sprints = @("SPRINT_3_PLAN.md","SPRINT_4_PLAN.md","SPRINT_5_PLAN.md"),
  [int]$DelaySeconds = 5,
  [switch]$StopOnFail
)
$ErrorActionPreference = "Stop"
foreach($s in $Sprints){
  Write-Host "=== RUNNING $s ===" -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\agent.ps1" -SprintFile $s
  $code = $LASTEXITCODE
  if($code -ne 0){
    Write-Host "Run failed for $s (exit $code)" -ForegroundColor Red
    if($StopOnFail){ exit $code }
  }
  Start-Sleep -Seconds $DelaySeconds
}
