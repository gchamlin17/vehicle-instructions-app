param([int]$Minutes = 5, [switch]$StopOnFail = $false)
$ErrorActionPreference="Stop"; Set-Location $PSScriptRoot
function readFlag($path,$def){ if (Test-Path $path) { (Get-Content $path -Raw).Trim() } else { $def } }
function getCfg(){ if (Test-Path .\config\agent_control.json){ Get-Content .\config\agent_control.json -Raw | ConvertFrom-Json } else { $null } }
function saveCfg($o){ if($o){ ($o|ConvertTo-Json -Depth 10) | Set-Content -Path .\config\agent_control.json -Encoding ascii } }
function noLimits(){ Test-Path ".\NO_LIMITS.flag" }

while ($true) {
  $mode = readFlag ".\AGENT_MODE.flag" "off"
  if ($mode -ne "on") { Start-Sleep 30; continue }

  $queue = readFlag ".\AGENT_QUEUE_MODE.flag" "FIFO"
  $cfg = getCfg

  if (-not (noLimits())) {
    if ($cfg) {
      $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
      $coolUntil = $cfg.last_run_end + ($cfg.cooldown_minutes * 60)
      if ($queue -ne "ONE" -and $cfg.remaining_runs -le 0) { Start-Sleep 30; continue }
      if ($now -lt $coolUntil) { Start-Sleep 30; continue }
    }
  }

  if ($queue -eq "ONE") {
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -StopOnFail:$StopOnFail
    if ($cfg -and -not (noLimits())) {
      $cfg.remaining_runs = [math]::Max(0, $cfg.remaining_runs - 1)
      $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
      saveCfg $cfg
    } elseif ($cfg) {
      $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); saveCfg $cfg
    }
    "FIFO" | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
  } elseif ($queue -like "FROM:*") {
    $from = $queue.Substring(5)
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -From $from -StopOnFail:$StopOnFail
    if ($cfg) { $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); saveCfg $cfg }
  } else {
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -StopOnFail:$StopOnFail
    if ($cfg) { $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); saveCfg $cfg }
  }

  Start-Sleep -Seconds ($Minutes * 60)
}
