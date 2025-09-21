param(
  [string]$SprintFile,
  [string]$Backlog,
  [string]$Config,
  [switch]$StopOnFail
)

$ErrorActionPreference = "Stop"

# Resolve project directory from this script's location
$ProjectDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

Write-Host "== agent.ps1 starting ==" -ForegroundColor Cyan
Write-Host ("PWD: " + $ProjectDir)

# Defaults (so no prompts)
if (-not $SprintFile -or $SprintFile -eq ".") { $SprintFile = "SPRINT_3_PLAN.md" }
if (-not $Backlog   -or $Backlog   -eq ".") { $Backlog   = "BACKLOG.md" }
if (-not $Config    -or $Config    -eq ".") { $Config    = "sprint.config.yaml" }

# Build absolute paths
$SprintPath  = if (Test-Path $SprintFile)  { (Resolve-Path $SprintFile).Path }  else { Join-Path $ProjectDir $SprintFile }
$BacklogPath = if (Test-Path $Backlog)     { (Resolve-Path $Backlog).Path }     else { Join-Path $ProjectDir $Backlog }
$ConfigPath  = if (Test-Path $Config)      { (Resolve-Path $Config).Path }      else { Join-Path $ProjectDir $Config }

Write-Host ("SprintFile: " + $SprintPath)
Write-Host ("Backlog:   " + $BacklogPath)
Write-Host ("Config:    " + $ConfigPath)

# Validate existence (no typos; avoids Test-Path prompts)
if (!(Test-Path $SprintPath))  { throw "Sprint file not found:  $SprintPath" }
if (!(Test-Path $BacklogPath)) { throw "Backlog file not found: $BacklogPath" }
if (!(Test-Path $ConfigPath))  { throw "Config file not found:  $ConfigPath" }

# Ensure Node present
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 18+ is required. Install from https://nodejs.org"
}
Write-Host ("Node version: " + (node -v))
Write-Host ("Node version: " + (node -v))

# Ensure yaml dependency (self-heal, in project root)
$pkg = Join-Path $ProjectDir "package.json"
$needYaml = $true
if (Test-Path $pkg) {
  try {
    $pkgJson = Get-Content $pkg -Raw | ConvertFrom-Json
    if ($pkgJson.dependencies -and $pkgJson.dependencies.yaml) { $needYaml = $false }
  } catch { $needYaml = $true }
}
if (-not (Test-Path $pkg)) {
  Write-Host "Bootstrapping package.json..." -ForegroundColor Yellow
  Push-Location $ProjectDir
  npm init -y | Out-Null
  npm pkg set type="module" | Out-Null
  Pop-Location
}
if ($needYaml -or -not (Test-Path (Join-Path $ProjectDir "node_modules\yaml\package.json"))) {
  Write-Host "Installing yaml runtime dep..." -ForegroundColor Yellow
  Push-Location $ProjectDir
  npm i yaml@2.5.1 | Out-Null
  Pop-Location
}

# Keep StopOnFail semantics simple (flag only)
if ($StopOnFail) { $true | Out-Null } else { $false | Out-Null }

# Build command
$node = "node"
$dry  = if ($DryRun) { "--dry" } else { "" }
$agentJs = Join-Path $PSScriptRoot "agent.mjs"
if (!(Test-Path $agentJs)) { throw "agent.mjs not found at $agentJs" }

# Transcript
$runDir = Join-Path $ProjectDir "agent_runs"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$transcriptPath = Join-Path $runDir "transcript_$ts.txt"
Start-Transcript -Path $transcriptPath -Force | Out-Null

# Exact command
$argList = @($agentJs, "--sprint", $SprintPath)
if ($BacklogPath) { $argList += @("--backlog", $BacklogPath) }
$argList += @("--config", $ConfigPath)
if ($dry -ne "") { $argList += $dry }
Write-Host ("CMD: node " + ($argList -join ' ')) -ForegroundColor Cyan

# Run and capture exit code
& $node @argList
$code = $LASTEXITCODE
Stop-Transcript | Out-Null

if ($code -ne 0) {
  Write-Host ("Agent FAILED with exit code " + $code) -ForegroundColor Red
  Write-Host ("See transcript: " + $transcriptPath) -ForegroundColor Yellow
  exit $code
}

Write-Host "Agent COMPLETED (exit 0)" -ForegroundColor Green
Write-Host ("Transcript at: " + $transcriptPath) -ForegroundColor Gray








