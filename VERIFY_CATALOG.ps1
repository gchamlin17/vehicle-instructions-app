param([string]$OrgId="household:test",[string]$OutPath=".\\agent_runs\\catalog.json")
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot\..\..
$proj = (Get-Content .\.firebaserc -Raw | ConvertFrom-Json).projects.default
$region="us-central1"
$fn="catalog"
$uri = ("https://{0}-{1}.cloudfunctions.net/{2}?orgId={3}" -f $region,$proj,$fn,[uri]::EscapeDataString($OrgId))
$r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 60
$r.Content | Set-Content -Path $OutPath -Encoding utf8
Write-Host ("Catalog written to "+$OutPath) -ForegroundColor Green
