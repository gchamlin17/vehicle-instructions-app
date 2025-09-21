param([string]$Root=".")
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot\..
$targets = Get-ChildItem -Path $Root -Recurse -Filter videos.json | Where-Object { $_.FullName -match '\\manifests\\videos\.json$' }
if (-not $targets){ Write-Host "No manifests found."; exit 0 }
$ok=$true
foreach($t in $targets){
  try { powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate\Validate-Manifest.ps1 -PathOrGsUri $t.FullName }
  catch { Write-Host ("? "+$_.Exception.Message) -ForegroundColor Red; $ok=$false }
}
if (-not $ok){ throw "Validation failed." } else { Write-Host "? All manifests valid." -ForegroundColor Green }
