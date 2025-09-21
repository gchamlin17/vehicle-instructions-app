param(
  [Parameter(Mandatory=$true)][string]$VehicleId,
  [string]$OutDir = "C:\Users\gregc\vi-clean\dist\pipeline-output"
)
$files = @(
  "$OutDir\$VehicleId`_video.mp4",
  "$OutDir\$VehicleId`_audio.mp3",
  "$OutDir\$VehicleId`_script.txt",
  "$OutDir\$VehicleId`_manifest.json"
)

foreach ($f in $files) {
  if (Test-Path -LiteralPath $f) {
    Write-Host "[OK]       $f" -ForegroundColor Green
  } else {
    Write-Host "[MISSING]  $f" -ForegroundColor Yellow
  }
}
