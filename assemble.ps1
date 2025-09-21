# assemble.ps1 ? resilient build/export (Windows PowerShell compatible)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\scripts\lib\Invoke-Npm.ps1"

function Log([string]$m,[ConsoleColor]$c=[ConsoleColor]::Gray){ $fc=$Host.UI.RawUI.ForegroundColor; $Host.UI.RawUI.ForegroundColor=$c; Write-Host $m; $Host.UI.RawUI.ForegroundColor=$fc }
function Resolve-Bin([string]$bin){ $cmd=Get-Command $bin -ErrorAction SilentlyContinue; if($cmd){return $cmd.Source}; $w=(where.exe $bin 2>$null|Select-Object -First 1); if($w){return $w}; return $null }

$ProjectDir = "$PSScriptRoot"; Set-Location $ProjectDir
$cands=@("app","frontend","."); $FrontDir=$null; foreach($rel in $cands){ $d=Join-Path $ProjectDir $rel; if(Test-Path (Join-Path $d "package.json")){$FrontDir=$d; break}}
if(-not $FrontDir){ Log "No frontend detected. Skipping build successfully." Yellow; exit 0 }
Log "Frontend detected at: $FrontDir" Cyan

Push-Location $FrontDir
try{
  if(-not (Get-Command node -ErrorAction SilentlyContinue)){ throw "Node.js required" }
  $hadLock=Test-Path .\package-lock.json
  try{ if($hadLock){ Log "npm ci..." Gray; Invoke-Npm @("ci","--no-audit","--no-fund","--silent") "npm ci" } else { Log "npm install..." Gray; Invoke-Npm @("install","--no-audit","--no-fund","--silent") "npm install" } }
  catch{ Log "Clean + retry with legacy peers..." Yellow; if(Test-Path .\node_modules){Remove-Item .\node_modules -Recurse -Force -ErrorAction SilentlyContinue}; if(Test-Path .\package-lock.json){Remove-Item .\package-lock.json -Force -ErrorAction SilentlyContinue}; Invoke-Npm @("install","--no-audit","--no-fund","--silent","--legacy-peer-deps") "npm install --legacy-peer-deps" }

  $pkg = Get-Content .\package.json -Raw | ConvertFrom-Json
  $hasExpo = $pkg.dependencies -and ($pkg.dependencies.PSObject.Properties.Name -contains "expo")
  $hasBuildScript = $pkg.scripts -and ($pkg.scripts.PSObject.Properties.Name -contains "build")

  if($hasExpo){
    Log "Expo export ? web-dist" Cyan
    $npx = Resolve-Bin "npx.cmd"; if(-not $npx){ throw "npx not found" }
    & $npx expo export --platform web --output-dir ./web-dist 2>&1
    if($LASTEXITCODE -ne 0 -and $hasBuildScript){ Log "Expo export failed; trying npm run build" Yellow; Invoke-Npm @("run","build","--silent") "npm run build" }
  } elseif($hasBuildScript) { Log "npm run build" Cyan; Invoke-Npm @("run","build","--silent") "npm run build" }
  Log "Assemble complete." Green; exit 0
} finally { Pop-Location }
