param(
  [Parameter(Mandatory=$true)][string]$CsvPath,
  [string]$OutDir = "C:\Users\gregc\vi-clean\dist\pipeline-output",
  [string]$Model  = "gpt-4o",
  [string]$Ffmpeg = $env:FFMPEG_EXE
)
$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

if ([string]::IsNullOrWhiteSpace($Ffmpeg)) {
  $Ffmpeg = "C:\Users\gregc\vi-clean\ffmpeg\ffmpeg\bin\ffmpeg.exe"
}

Write-Host "[run_batch_v2] Using CSV: $CsvPath" -ForegroundColor Cyan
if (!(Test-Path -LiteralPath $CsvPath)) { throw "[run_batch_v2] CSV not found at $CsvPath" }

Write-Host "[run_batch_v2] CSV preview:" -ForegroundColor DarkCyan
Get-Content -LiteralPath $CsvPath -TotalCount 5 | ForEach-Object { "  $_" }

$rows = Import-Csv -Path $CsvPath
$rowsCount = @($rows).Count
Write-Host "[run_batch_v2] Row count: $rowsCount" -ForegroundColor Yellow
if ($rowsCount -eq 0) { Write-Warning "[run_batch_v2] No data rows."; return }

if (!(Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

$pipeline = if (Test-Path -LiteralPath ".\scripts\pipeline_v3.py") { ".\scripts\pipeline_v3.py" } else { ".\scripts\pipeline_v2.py" }
Write-Host "[run_batch_v2] Pipeline: $pipeline" -ForegroundColor Cyan
Write-Host "[run_batch_v2] FFmpeg:   $Ffmpeg"   -ForegroundColor Cyan

$idx = 0
foreach ($row in $rows) {
  $idx++
  $vid   = $row.vehicleId
  $pdf   = $row.pdf
  $imgsS = $row.images

  Write-Host "=== ($idx/$rowsCount) PROCESSING $vid ===" -ForegroundColor Green

  if ([string]::IsNullOrWhiteSpace($vid) -or [string]::IsNullOrWhiteSpace($pdf) -or [string]::IsNullOrWhiteSpace($imgsS)) {
    Write-Warning "  [skip] Missing vehicleId/pdf/images"
    continue
  }
  if (!(Test-Path -LiteralPath $pdf)) {
    Write-Warning "  [skip] PDF not found: $pdf"
    continue
  }
  $imgs = $imgsS -split ';' | ForEach-Object { $_.Trim('"').Trim() }
  $missing = @(); foreach ($i in $imgs) { if (!(Test-Path -LiteralPath $i)) { $missing += $i } }
  if ($missing.Count -gt 0) {
    Write-Warning ("  [skip] Missing image(s): " + ($missing -join ", "))
    continue
  }

  $args = @("--pdf", $pdf, "--output", $OutDir, "--vehicle", $vid, "--model", $Model, "--ffmpeg", $Ffmpeg)
  if ($pipeline -like "*pipeline_v3.py") { $args += @("--images", ($imgs -join ";")) } else { $args += @("--image", $imgs[0]) }

  Write-Host "  [run] py $pipeline $($args -join ' ')" -ForegroundColor DarkYellow
  & py $pipeline @args 2>&1 | Tee-Object -Variable pipeLog | Write-Host
  if ($LASTEXITCODE -ne 0) { Write-Warning "  [warn] Pipeline exit code $LASTEXITCODE" }

  $video = Join-Path $OutDir "${vid}_video.mp4"
  if (Test-Path -LiteralPath $video) {
    Write-Host "  [ok] Video created: $video" -ForegroundColor Green
    if (Test-Path -LiteralPath ".\scripts\upload_to_firebase_v2.js") {
      Write-Host "  [upload] node scripts\upload_to_firebase_v2.js $vid $OutDir" -ForegroundColor Cyan
      node .\scripts\upload_to_firebase_v2.js $vid $OutDir 2>&1 | Write-Host
    } else {
      Write-Host "  [info] uploader v2 not found, skipping upload." -ForegroundColor DarkGray
    }
  } else {
    Write-Warning "  [miss] Video not found, skipping upload: $video"
  }

  Write-Host "=== DONE $vid ===" -ForegroundColor Green
}
