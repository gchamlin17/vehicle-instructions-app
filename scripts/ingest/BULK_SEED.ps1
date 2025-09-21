param(
  [string]$OrgId="household:test",
  [string[]]$Vehicles=@("honda/cr-v/2020/ex","toyota/camry/2020/le","ford/f-150/2021/xlt","chevrolet/silverado/2021/lt","nissan/rogue/2019/sl","hyundai/sonata/2022/sel"),
  [int]$ClipsPerVehicle=3,
  [switch]$MakePlaceholders=$true
)
$ErrorActionPreference="Stop"
function Sanitize-Part([string]$s){ return ($s -replace '[:*?"<>|]', '_') }
Set-Location $PSScriptRoot\..\..

$orgLocal = Sanitize-Part $OrgId
foreach($veh in $Vehicles){
  $parts = ($veh -replace '\\','/') -split '/'
  $base = Join-Path ".\data\sample_videos" $orgLocal
  foreach($p in $parts){ $base = Join-Path $base (Sanitize-Part $p) }
  $videos = Join-Path $base "videos"; $captions = Join-Path $base "captions"
  if(!(Test-Path $videos)){ New-Item -ItemType Directory -Force -Path $videos | Out-Null }
  if(!(Test-Path $captions)){ New-Item -ItemType Directory -Force -Path $captions | Out-Null }
  # make caption+optional placeholder mp4s
  1..$ClipsPerVehicle | ForEach-Object {
    $clipId = ("clip-{0:D2}" -f $_)
    $vtt = Join-Path $captions ($clipId + ".vtt")
    if(!(Test-Path $vtt)){ "WEBVTT`n`n00:00.000 --> 00:05.000`n$clipId" | Set-Content $vtt -Encoding ascii }
    if($MakePlaceholders){
      $mp4 = Join-Path $videos ($clipId + ".mp4")
      if(!(Test-Path $mp4)){ Set-Content -Path $mp4 -Value $null -Encoding byte } # zero-byte placeholder
    }
  }
}
Write-Host ("Bulk seed complete for "+$Vehicles.Count+" vehicles") -ForegroundColor Green
