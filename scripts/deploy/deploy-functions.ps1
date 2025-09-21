$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\lib\WriteNoBom.ps1"

$root = 'C:\Users\gregc\vi-clean'
$funcDir = Join-Path $root 'functions'
if (-not (Test-Path $funcDir)) { New-Item -ItemType Directory -Force -Path $funcDir | Out-Null }

# firebase.json
$firebaseJsonPath = Join-Path $root 'firebase.json'
if (-not (Test-Path $firebaseJsonPath)) {
  Write-NoBom -Path $firebaseJsonPath -Content @'
{ "functions": { "source": "functions", "runtime": "nodejs20" },
  "hosting":   { "ignore": ["firebase.json","**/.*","**/node_modules/**"] } }
'@
} else {
  $raw = Get-Content $firebaseJsonPath -Raw
  try { $parsed = $raw | ConvertFrom-Json } catch { throw 'firebase.json invalid' }
  if (-not ($parsed.PSObject.Properties.Name -contains 'functions')) {
    $parsed | Add-Member -NotePropertyName functions -NotePropertyValue ([pscustomobject]@{source='functions';runtime='nodejs20'}) -Force
  } else {
    if (-not $parsed.functions.source)  { $parsed.functions | Add-Member -NotePropertyName source  -NotePropertyValue 'functions' -Force }
    if (-not $parsed.functions.runtime) { $parsed.functions | Add-Member -NotePropertyName runtime -NotePropertyValue 'nodejs20' -Force }
  }
  Write-NoBom -Path $firebaseJsonPath -Content ($parsed | ConvertTo-Json -Depth 12)
}

# .firebaserc
$firebaserc = Join-Path $root '.firebaserc'
if (-not (Test-Path $firebaserc)) {
  Write-NoBom -Path $firebaserc -Content ('{ "projects": { "default": "' + 'vehicle-instructions-app' + '" } }')
}

# functions/package.json
$funcPkg = Join-Path $funcDir 'package.json'
$needsInstall = $false
if (-not (Test-Path $funcPkg)) {
  Write-NoBom -Path $funcPkg -Content @'
{ "name": "vi-functions", "private": true, "main": "index.js",
  "engines": { "node": "20" },
  "dependencies": { "firebase-functions": "^5.1.0", "firebase-admin": "^12.5.0" } }
'@
  $needsInstall = $true
} else {
  $pkg = Get-Content $funcPkg -Raw | ConvertFrom-Json
  if (-not $pkg.engines) { $pkg | Add-Member -NotePropertyName engines -NotePropertyValue @{ node='20' } -Force }
  elseif (-not $pkg.engines.node) { $pkg.engines | Add-Member -NotePropertyName node -NotePropertyValue '20' -Force }
  if (-not $pkg.dependencies) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue @{} -Force }
  if (-not $pkg.dependencies.'firebase-functions' -or -not ($pkg.dependencies.'firebase-functions' -match '^5')) { $pkg.dependencies.'firebase-functions'='^5.1.0'; $needsInstall = $true }
  if (-not $pkg.dependencies.'firebase-admin') { $pkg.dependencies.'firebase-admin'='^12.5.0'; $needsInstall = $true }
  Write-NoBom -Path $funcPkg -Content ($pkg | ConvertTo-Json -Depth 12)
}

# functions/index.js (v2)
$indexJs = Join-Path $funcDir 'index.js'
if (-not (Test-Path $indexJs)) {
  Write-NoBom -Path $indexJs -Content @'
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ region: "us-central1" });
exports.ping = onRequest((req, res) => res.status(200).send("ok"));
'@
}

# npm install if needed
Push-Location $funcDir
try {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm required' }
  $have = Test-Path (Join-Path $funcDir 'node_modules\firebase-functions\package.json')
  if ($needsInstall -or -not $have) {
    if (Test-Path .\node_modules) { Remove-Item .\node_modules -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path .\package-lock.json) { Remove-Item .\package-lock.json -Force -ErrorAction SilentlyContinue }
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  }
} finally { Pop-Location }

# Deploy with one retry
function Invoke-FirebaseDeploy {
  if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { throw 'Install Firebase CLI: npm i -g firebase-tools' }
  $env:CI='1'
  firebase deploy --only functions --non-interactive
  if ($LASTEXITCODE -ne 0) {
    Push-Location $funcDir; try { npm install } finally { Pop-Location }
    Start-Sleep 3
    firebase deploy --only functions --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed ($LASTEXITCODE)" }
  }
}
Invoke-FirebaseDeploy
