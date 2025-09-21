param(
  [string]$OrgId="household:test",
  [string[]]$Vehicles=@("honda/cr-v/2020/ex","toyota/camry/2020/le","ford/f-150/2021/xlt","chevrolet/silverado/2021/lt","nissan/rogue/2019/sl","hyundai/sonata/2022/sel")
)
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot\..\..
foreach($veh in $Vehicles){
  Write-Host ("Ingest ? "+$veh) -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ingest\QUEUE_AND_PROCESS.ps1 -OrgId $OrgId -Vehicle $veh
}
Write-Host "Bulk ingest finished." -ForegroundColor Green
