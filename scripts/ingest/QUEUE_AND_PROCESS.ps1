param(
  [string]$OrgId="household:test",
  [string]$Vehicle="honda/cr-v/2020/ex",
  [string]$Bucket=""
)
$ErrorActionPreference="Stop"
function Sanitize-Part([string]$s){ return ($s -replace '[:*?"<>|]', '_') }

# Local source path
Set-Location $PSScriptRoot\..\..
$orgLocal = Sanitize-Part $OrgId
$vehParts = ($Vehicle -replace '\\','/') -split '/'
$src = Join-Path ".\data\sample_videos" $orgLocal
foreach($p in $vehParts){ $src = Join-Path $src (Sanitize-Part $p) }
if (!(Test-Path $src)) { throw ("Source not found: "+$src) }

# Resolve bucket
if (-not $Bucket) {
  $proj = (Get-Content .\.firebaserc -Raw | ConvertFrom-Json).projects.default
  if (-not $proj) { throw "No default project in .firebaserc" }
  $Bucket = "$proj.appspot.com"
}

# Remote base
$vehicleKey = ($Vehicle -replace '\\','/').Trim('/')
$baseRemote = "$OrgId/$vehicleKey"

# Upload with Firebase CLI
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { throw "Install Firebase CLI: npm i -g firebase-tools" }
$vid = Join-Path $src "videos"
$cap = Join-Path $src "captions"
if (Test-Path $vid -and (Get-ChildItem $vid -File | Where-Object {$_.Extension -ieq ".mp4"})) {
  firebase storage:upload "$vid\*.mp4" --bucket $Bucket --path "$baseRemote/videos/" | Out-Null
}
if (Test-Path $cap -and (Get-ChildItem $cap -File | Where-Object {$_.Extension -ieq ".vtt"})) {
  firebase storage:upload "$cap\*.vtt" --bucket $Bucket --path "$baseRemote/captions/" | Out-Null
}

Write-Host ("Uploaded to gs://{0}/{1}" -f $Bucket,$baseRemote) -ForegroundColor Cyan

# Force manifest rebuild via HTTP function
$region="us-central1"
$fn="rebuild"
$proj = (Get-Content .\.firebaserc -Raw | ConvertFrom-Json).projects.default
$qs = ("orgId={0}&vehicleKey={1}" -f [uri]::EscapeDataString($OrgId), [uri]::EscapeDataString($vehicleKey))
$uri = ("https://{0}-{1}.cloudfunctions.net/{2}?{3}" -f $region, $proj, $fn, $qs)
try {
  $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 60
  Write-Host ("Rebuild response: " + $r.Content) -ForegroundColor Green
} catch {
  Write-Host ("Rebuild call failed: "+$_.Exception.Message) -ForegroundColor Yellow
  Write-Host "Worker will still rebuild via Pub/Sub on next upload finalize." -ForegroundColor Yellow
}
