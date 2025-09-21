#!/usr/bin/env pwsh
# .githooks\pre-commit.ps1 ? validates changed manifests before commit
$ErrorActionPreference = "Stop"
Set-Location (git rev-parse --show-toplevel)
$changed = git diff --cached --name-only --diff-filter=ACMR | Where-Object { $_ -match 'manifests/videos\.json$' }
if (-not $changed) { exit 0 }
Write-Host "Pre-commit: validating manifests..." -ForegroundColor Cyan
$ok = $true
foreach ($f in $changed) {
  try {
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate\Validate-Manifest.ps1 -PathOrGsUri $f
  } catch {
    Write-Host ("? "+$_.Exception.Message) -ForegroundColor Red
    $ok = $false
  }
}
if (-not $ok) {
  Write-Host "Commit blocked: manifest validation failed." -ForegroundColor Red
  exit 1
}
Write-Host "? All manifests valid." -ForegroundColor Green
