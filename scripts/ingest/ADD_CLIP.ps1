param(
  [Parameter(Mandatory)][string]$Vehicle,   # e.g. "honda/cr-v/2020/ex"
  [string]$OrgId="household:test",
  [Parameter(Mandatory)][string]$ClipId,    # e.g. "tpms-reset"
  [string]$FromFile="",                     # path to an .mp4 (optional)
  [switch]$MakeCaption                      # create stub VTT
)
$ErrorActionPreference="Stop"
function Sanitize-Part([string]$s){ return ($s -replace '[:*?"<>|]', '_') }

Set-Location $PSScriptRoot\..\..
$orgLocal = Sanitize-Part $OrgId
$vehParts = ($Vehicle -replace '\\','/') -split '/'
$base = Join-Path ".\data\sample_videos" $orgLocal
foreach($p in $vehParts){ $base = Join-Path $base (Sanitize-Part $p) }
$videos = Join-Path $base "videos"; $captions = Join-Path $base "captions"
if(!(Test-Path $videos)){ New-Item -ItemType Directory -Force -Path $videos | Out-Null }
if(!(Test-Path $captions)){ New-Item -ItemType Directory -Force -Path $captions | Out-Null }

$mp4 = Join-Path $videos ($ClipId + ".mp4")
if($FromFile -and (Test-Path $FromFile)){ Copy-Item $FromFile $mp4 -Force }
elseif(!(Test-Path $mp4)) {
  # create a tiny placeholder (0 bytes) ? will not play, but keeps pipeline moving
  Set-Content -Path $mp4 -Value $null -Encoding byte
}
if($MakeCaption){
  $vtt = Join-Path $captions ($ClipId + ".vtt")
  if(!(Test-Path $vtt)){ "WEBVTT`n`n00:00.000 --> 00:03.000`n$ClipId" | Set-Content -Path $vtt -Encoding ascii }
}
Write-Host ("Local clip staged at: " + $mp4) -ForegroundColor Green
