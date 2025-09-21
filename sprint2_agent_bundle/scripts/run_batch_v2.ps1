param(
  [Parameter(Mandatory=$true)][string]$CsvPath,
  [string]$OutDir = "C:\Users\gregc\vi-clean\dist\pipeline-output",
  [string]$Ffmpeg = "C:\Users\gregc\vi-clean\ffmpeg\ffmpeg\bin\ffmpeg.exe",
  [string]$Model = "gpt-4o"
)
$ErrorActionPreference = "Stop"
if (!(Test-Path $CsvPath)) { throw "CSV not found: $CsvPath" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Import-Csv -Path $CsvPath | ForEach-Object {
  $vid = $_.vehicleId; $pdf = $_.pdf; $images = $_.images
  if (-not $vid -or -not (Test-Path $pdf) -or -not $images) {
    Write-Host "Skipping row; missing vehicleId/pdf/images -> $($_ | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    return
  }
  Write-Host "=== PROCESSING $vid ===" -ForegroundColor Cyan
  py scripts\pipeline_v3.py --pdf "$pdf" --images "$images" --output "$OutDir" --vehicle "$vid" --model $Model --ffmpeg "$Ffmpeg"

  if (Test-Path -LiteralPath "$OutDir\$vid`_video.mp4") {
    node scripts\upload_to_firebase_v2.js "$vid" "$OutDir"
    Write-Host "=== DONE $vid ===" -ForegroundColor Green
  } else {
    Write-Host "Video not created for $vid, skipping upload." -ForegroundColor Yellow
  }
}
