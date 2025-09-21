# Vehicle Instructions ? Data Ingestion Standard (v1)

**Goal:** Every data source (OEM/manufacturer, dealer, partner) delivers the *same* folder layout and manifest format so ingestion, validation, and UI behave identically.

## Folder layout (Cloud Storage)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate\Validate-Manifest.ps1 `
  -PathOrGsUri "gs://vehicle-instructions-app.appspot.com/household:test/honda/cr-v/2020/ex/manifests/videos.json"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate\Validate-Manifest.ps1 `
  -PathOrGsUri ".\app\web-dist\manifests\videos.json"
# ================= PRE-COMMIT HOOK INSTALL =================
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\gregc\vi-clean"
New-Item -ItemType Directory -Force -Path .\.githooks, .\scripts\validate | Out-Null

# Ensure validator exists (re-create if missing)
if (!(Test-Path .\scripts\validate\Validate-Manifest.ps1)) {
@'
param([Parameter(Mandatory=$true)][string]$PathOrGsUri,[string]$SchemaPath = ".\app\manifest.schema.json")
$ErrorActionPreference="Stop"
function Match($v,$rx){ if(-not $v){return $false}; return [bool]([regex]::Match([string]$v,$rx).Success) }
if (!(Test-Path $SchemaPath)) { throw "Schema not found: $SchemaPath" }
$inPath = $PathOrGsUri
if (!(Test-Path $inPath)) { throw "Input not found: $inPath" }
$schema = Get-Content $SchemaPath -Raw | ConvertFrom-Json
$manifestRaw = Get-Content $inPath -Raw
try { $m = $manifestRaw | ConvertFrom-Json } catch { throw "Invalid JSON in $inPath" }
if ($m.version -ne 1) { throw "version must equal 1" }
if (-not $m.orgId -or -not $m.vehicleKey) { throw "orgId/vehicleKey required" }
if (-not (Match $m.vehicleKey '^[a-z0-9-]+/[a-z0-9-]+/\d{4}/[a-z0-9-]+$')) { throw "vehicleKey pattern invalid" }
foreach($c in $m.clips){
  if (-not (Match $c.id '^[a-z0-9]+(?:-[a-z0-9]+)*$')) { throw "clip id invalid: $($c.id)" }
  if (-not (Match $c.src '^videos/[a-z0-9-]+\.mp4$')) { throw "src invalid: $($c.src)" }
  if ($c.caption -and -not (Match $c.caption '^captions/[a-z0-9-]+\.vtt$')) { throw "caption invalid: $($c.caption)" }
}
Write-Host "? Manifest OK: $inPath" -ForegroundColor Green
