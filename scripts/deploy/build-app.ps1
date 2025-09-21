$ErrorActionPreference = "Stop"
$root = $env:VI_PROJECT_DIR
if (-not $root -or -not (Test-Path $root)) { throw "VI_PROJECT_DIR not set/found: $root" }
Write-Host ("Using VI_PROJECT_DIR: " + $root) -ForegroundColor Cyan

$assemble = Join-Path $root "assemble.ps1"
if (Test-Path $assemble) {
  Write-Host ("Running assemble.ps1 at " + $assemble) -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File $assemble
  exit $LASTEXITCODE
}

if (Test-Path (Join-Path $root "app\package.json")) {
  Push-Location (Join-Path $root "app")
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm required." }
  npm ci
  npm run build 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "Build script not found; trying expo export"; npx expo export }
  Pop-Location
} else {
  Write-Host "No assemble.ps1 and no app\package.json; skipping build." -ForegroundColor Yellow
}
