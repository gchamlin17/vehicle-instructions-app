param(
  [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "agent_runs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$transcript = Join-Path $logDir "full_run_$ts.txt"
$summary    = Join-Path $logDir "run_report_$ts.md"

Start-Transcript -Path $transcript -Force | Out-Null

function Step([string]$name, [scriptblock]$block) {
  Write-Host "=== $name ===" -ForegroundColor Cyan
  $start = Get-Date
  try {
    & $block
    $status = "OK"
  } catch {
    Write-Host ("? {0} failed: {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
    $status = "FAIL: {0}" -f $_.Exception.Message
    throw
  } finally {
    $end = Get-Date
    Add-Content -Path $summary -Value ("- **{0}** ? {1:HH:mm:ss} ? {2:HH:mm:ss}: {3}" -f $name, $start, $end, $status)
  }
}

# 0) System info
$sys = @()
$sys += "## System Info"
$sys += ("- PowerShell: " + $PSVersionTable.PSVersion.ToString())
try { $sys += ("- Node: " + (node -v)) } catch {}
try { $sys += ("- npm: "  + (npm -v)) }  catch {}
try { $sys += ("- Firebase CLI: " + (firebase --version)) } catch {}
try { $sys += ("- Expo CLI: "     + (npx expo --version)) } catch {}
$sys += ""

Set-Content -Path $summary -Value "# Vehicle Instructions App ? Run Report"
Add-Content -Path $summary -Value ("_Run started: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
Add-Content -Path $summary -Value ""
$sys | ForEach-Object { Add-Content -Path $summary -Value $_ }

# 1) Deploy Functions
if (Test-Path .\scripts\deploy\deploy-functions.ps1) {
  Step "Deploy Functions" { powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy\deploy-functions.ps1 }
} else {
  Write-Host "No deploy wrapper found?skipping functions deploy." -ForegroundColor Yellow
  Add-Content -Path $summary -Value "- **Deploy Functions** ? SKIPPED"
}

# 2) Assemble Frontend
if (Test-Path .\assemble.ps1) {
  Step "Assemble Frontend" { powershell -NoProfile -ExecutionPolicy Bypass -File .\assemble.ps1 }
} else {
  Write-Host "assemble.ps1 not found?skipping build." -ForegroundColor Yellow
  Add-Content -Path $summary -Value "- **Assemble Frontend** ? SKIPPED"
}

# 3) Run Sprint Queue
Step "Run Queue" { powershell -NoProfile -ExecutionPolicy Bypass -File .\run_queue.ps1 -StopOnFail }

# 4) Serve UI & open browser
function Serve-Static([string]$dir, [int]$port) {
  Write-Host ("Serving static export from: {0} (http://localhost:{1})" -f $dir, $port) -ForegroundColor Green
  Start-Process cmd "/c npx http-server `"$dir`" -p $port -c-1" -WindowStyle Hidden
  Start-Sleep -Seconds 2
  Start-Process ("http://localhost:{0}" -f $port)
}

$export1 = Join-Path $PSScriptRoot "app\web-dist"
$export2 = Join-Path $PSScriptRoot "web-dist"
$pkgApp  = Join-Path $PSScriptRoot "app\package.json"
$pkgRoot = Join-Path $PSScriptRoot "package.json"

$served = $false
if (Test-Path $export1) { Serve-Static $export1 $WebPort; $served = $true }
elseif (Test-Path $export2) { Serve-Static $export2 $WebPort; $served = $true }
else {
  $hasExpo = $false
  if (Test-Path $pkgApp)  { try { $j = Get-Content $pkgApp -Raw | ConvertFrom-Json;  if ($j.dependencies.expo) { $hasExpo = $true } } catch {} }
  if (-not $hasExpo -and (Test-Path $pkgRoot)) { try { $k = Get-Content $pkgRoot -Raw | ConvertFrom-Json; if ($k.dependencies.expo) { $hasExpo = $true } } catch {} }

  if ($hasExpo) {
    Write-Host "Starting Expo web dev server..." -ForegroundColor Green
    Start-Process cmd "/c npx expo start --web" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    Start-Process "http://localhost:19006"
    $served = $true
  }
}

if ($served) {
  Add-Content -Path $summary -Value "- **Preview** ? UI opened in browser."
} else {
  Add-Content -Path $summary -Value "- **Preview** ? No export or Expo detected; skipped."
}

Add-Content -Path $summary -Value ""
Add-Content -Path $summary -Value ("**Transcript:** " + $transcript)
Add-Content -Path $summary -Value ("**Summary:** "    + $summary)

Stop-Transcript | Out-Null

# 5) Package artifacts as a zip
$artDir = Join-Path $logDir "artifacts"
if (-not (Test-Path $artDir)) { New-Item -ItemType Directory -Force -Path $artDir | Out-Null }
$zipBase = "run_artifact_$ts"
$zipPath = Join-Path $artDir ($zipBase + ".zip")

# include summary, transcript, last sprint transcript (if any), and assemble/deploy scripts for reproducibility
$toZip = New-Object System.Collections.ArrayList
[void]$toZip.Add($summary)
[void]$toZip.Add($transcript)
$latestSprintLog = Get-ChildItem $logDir -Filter "transcript_*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestSprintLog) { [void]$toZip.Add($latestSprintLog.FullName) }
if (Test-Path ".\assemble.ps1") { [void]$toZip.Add((Resolve-Path ".\assemble.ps1").Path) }
if (Test-Path ".\scripts\deploy\deploy-functions.ps1") { [void]$toZip.Add((Resolve-Path ".\scripts\deploy\deploy-functions.ps1").Path) }

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $toZip -DestinationPath $zipPath

Write-Host ("`n? RUN_AND_PREVIEW complete. Artifact: " + $zipPath) -ForegroundColor Cyan
Write-Host ("Transcript: " + $transcript)
Write-Host ("Summary:    " + $summary)
