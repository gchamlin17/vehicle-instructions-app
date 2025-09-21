param([string]$Reason="unspecified")
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$triDir = Join-Path ".\agent_runs" ("triage_"+$stamp)
New-Item -ItemType Directory -Force -Path $triDir | Out-Null

# copy recent transcripts and config
Get-ChildItem .\agent_runs -Filter *.txt | Sort-Object LastWriteTime -desc | Select-Object -First 5 | Copy-Item -Destination $triDir
Copy-Item .\config\* -Destination $triDir -Recurse -ErrorAction SilentlyContinue
Copy-Item .\firebase.json, .\.firebaserc, .\firestore.rules, .\storage.rules -Destination $triDir -ErrorAction SilentlyContinue
Copy-Item .\scripts\deploy\*.ps1, .\assemble.ps1 -Destination $triDir -ErrorAction SilentlyContinue

# summarise
@("reason=$Reason","stamp=$stamp","host=$env:COMPUTERNAME") | Set-Content (Join-Path $triDir "meta.txt")

$zip = Join-Path ".\agent_runs\artifacts" ("triage_"+$stamp+".zip")
if (!(Test-Path ".\agent_runs\artifacts")) { New-Item -ItemType Directory -Force -Path ".\agent_runs\artifacts" | Out-Null }
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $triDir -DestinationPath $zip
Write-Host ("Triage bundle: "+$zip) -ForegroundColor Yellow

# notify
. .\scripts\lib\Notify.ps1 -Title "VI Agent ? Failure triage" -Message ("Bundle: "+$zip) -Level "err"
