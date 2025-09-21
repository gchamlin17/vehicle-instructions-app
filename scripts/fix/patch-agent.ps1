param(
  [string]$Root = "C:\Users\gregc\vi-clean"
)

$ErrorActionPreference = "Stop"

$agent = Join-Path $Root "agent.ps1"
if (-not (Test-Path $agent)) { throw "agent.ps1 not found at $agent" }

$inject = @"
# Ensure Node + deps (self-heal)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 18+ is required. Install from https://nodejs.org"
}
Write-Host ("Node version: " + (node -v)) -ForegroundColor Gray

$pkg = Join-Path $PSScriptRoot "package.json"
$needYaml = $true
if (Test-Path $pkg) {
  try {
    $pkgJson = Get-Content $pkg -Raw | ConvertFrom-Json
    if ($pkgJson.dependencies -and $pkgJson.dependencies.yaml) { $needYaml = $false }
  } catch { $needYaml = $true }
}

if (-not (Test-Path $pkg)) {
  Write-Host "Bootstrapping package.json..." -ForegroundColor Yellow
  Push-Location $PSScriptRoot
  npm init -y | Out-Null
  npm pkg set type="module" | Out-Null
  Pop-Location
}

if ($needYaml -or -not (Test-Path (Join-Path $PSScriptRoot "node_modules\yaml\package.json"))) {
  Write-Host "Installing yaml runtime dep..." -ForegroundColor Yellow
  Push-Location $PSScriptRoot
  npm i yaml@2.5.1 | Out-Null
  Pop-Location
}
"@

# read agent.ps1
$text = Get-Content $agent -Raw

# already patched?
if ($text -match '\bInstalling yaml runtime dep') {
  Write-Host "agent.ps1 already contains the self-heal block. Skipping." -ForegroundColor Yellow
} else {
  # Prefer placing right before "# Build command"
  if ($text -match '(?m)^#\s*Build command') {
    $text = $text -replace '(?m)^#\s*Build command', ($inject + "`r`n# Build command")
  }
  else {
    # If there is a prior "Ensure Node + deps" marker, replace that region up to Build command
    if ($text -match '(?s)#\s*Ensure Node \+ deps.*?#\s*Build command') {
      $text = [regex]::Replace($text, '#\s*Ensure Node \+ deps.*?#\s*Build command', ($inject + "`r`n# Build command"), 'Singleline')
    } else {
      # No anchors found; prepend safely
      $text = $inject + "`r`n" + $text
    }
  }

  Set-Content -Path $agent -Value $text -Encoding ascii
  Write-Host "Patched agent.ps1 ?" -ForegroundColor Green
}

# show a quick preview of the injected lines
(Get-Content $agent) | Select-String -SimpleMatch "Installing yaml runtime dep" -Context 4,4 | ForEach-Object {
  "----- preview -----"
  $_.Context.PreContext
  $_.Line
  $_.Context.PostContext
  "-------------------"
}
