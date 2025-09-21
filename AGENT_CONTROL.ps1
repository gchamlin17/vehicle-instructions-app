param(
  [ValidateSet("status","start","stop","run-once","run-all","run-from","set-quota","set-cooldown")]
  [string]$cmd = "status",
  [string]$arg = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$configPath = ".\config\agent_control.json"
if (!(Test-Path $configPath)) { throw "Missing config: $configPath" }
$cfg = Get-Content $configPath -Raw | ConvertFrom-Json

function SaveCfg() { param($obj) ($obj | ConvertTo-Json -Depth 10) | Set-Content -Path $configPath -Encoding ascii }

function PrintStatus() {
  Write-Host "Agent Mode flag: " -NoNewline
  if (Test-Path .\AGENT_MODE.flag) { (Get-Content .\AGENT_MODE.flag -Raw).Trim() | Write-Host }
  else { Write-Host "off" }
  $mode = if (Test-Path .\AGENT_QUEUE_MODE.flag) { (Get-Content .\AGENT_QUEUE_MODE.flag -Raw).Trim() } else { $cfg.default_queue_mode }
  Write-Host ("Queue mode: {0}" -f $mode)
  Write-Host ("Remaining runs: {0}" -f $cfg.remaining_runs)
  if ($cfg.last_run_end -gt 0) {
    $lastEnd = [DateTimeOffset]::FromUnixTimeSeconds([int64]$cfg.last_run_end).LocalDateTime
    Write-Host ("Last run ended: {0}" -f $lastEnd)
  } else { Write-Host "Last run ended: never" }
  Write-Host ("Cooldown (minutes): {0}" -f $cfg.cooldown_minutes)
}

switch ($cmd) {
  "status" { PrintStatus; break }

  "start" {
    "on" | Set-Content .\AGENT_MODE.flag -Encoding ascii
    $mode = if ($arg) { $arg } else { $cfg.default_queue_mode }
    $mode | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
    # start loop minimized if not already
    $running = Get-Process powershell -ErrorAction SilentlyContinue | ? { $_.Path -match "RUN_AGENT_MODE\.ps1" }
    if (-not $running) {
      Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File .\RUN_AGENT_MODE.ps1" -WindowStyle Minimized
    }
    Write-Host "Agent Mode ON. Loop watcher running."
    PrintStatus
    break
  }

  "stop" {
    "off" | Set-Content .\AGENT_MODE.flag -Encoding ascii
    Write-Host "Agent Mode OFF. (Loop will idle within ~60s.)"
    PrintStatus
    break
  }

  "run-once" {
    # respect quota & cooldown
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $coolUntil = $cfg.last_run_end + ($cfg.cooldown_minutes * 60)
    if ($cfg.remaining_runs -le 0) { throw "No remaining_runs left in agent_control.json" }
    if ($now -lt $coolUntil) {
      $wait = [TimeSpan]::FromSeconds($coolUntil - $now)
      throw ("Cooldown active. Try again in ~{0:mm\:ss}" -f $wait)
    }

    "on" | Set-Content .\AGENT_MODE.flag -Encoding ascii
    "ONE" | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -StopOnFail  # runs all, but loop handles ONE
    if ($LASTEXITCODE -ne 0) { throw "RUN_SPRINTS exited $LASTEXITCODE" }

    # decrement quota and stamp last_run_end
    $cfg.remaining_runs = [math]::Max(0, $cfg.remaining_runs - 1)
    $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    SaveCfg $cfg
    Write-Host "Run complete. remaining_runs decremented."
    PrintStatus
    break
  }

  "run-all" {
    "on" | Set-Content .\AGENT_MODE.flag -Encoding ascii
    "FIFO" | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -StopOnFail
    if ($LASTEXITCODE -ne 0) { throw "RUN_SPRINTS exited $LASTEXITCODE" }
    $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    SaveCfg $cfg
    Write-Host "All sprints complete."
    PrintStatus
    break
  }

  "run-from" {
    if (-not $arg) { throw "Provide a sprint file, e.g. run-from SPRINT_3_PLAN.md" }
    "on" | Set-Content .\AGENT_MODE.flag -Encoding ascii
    ("FROM:{0}" -f $arg) | Set-Content .\AGENT_QUEUE_MODE.flag -Encoding ascii
    powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_SPRINTS.ps1 -From $arg -StopOnFail
    if ($LASTEXITCODE -ne 0) { throw "RUN_SPRINTS exited $LASTEXITCODE" }
    $cfg.last_run_end = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    SaveCfg $cfg
    Write-Host ("Sprints complete from {0}." -f $arg)
    PrintStatus
    break
  }

  "set-quota" {
    if (-not $arg -or -not ($arg -as [int])) { throw "Usage: set-quota <int>" }
    $cfg.remaining_runs = [int]$arg
    SaveCfg $cfg
    Write-Host ("remaining_runs set to {0}" -f $cfg.remaining_runs)
    PrintStatus
    break
  }

  "set-cooldown" {
    if (-not $arg -or -not ($arg -as [int])) { throw "Usage: set-cooldown <minutes>" }
    $cfg.cooldown_minutes = [int]$arg
    SaveCfg $cfg
    Write-Host ("cooldown_minutes set to {0}" -f $cfg.cooldown_minutes)
    PrintStatus
    break
  }
}
