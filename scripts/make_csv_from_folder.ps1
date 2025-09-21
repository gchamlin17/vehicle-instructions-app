param(
  [Parameter(Mandatory=$true)][string]$VehicleId,
  [Parameter(Mandatory=$true)][string]$PdfPath,
  [Parameter(Mandatory=$true)][string]$ImagesDir,
  [string]$OutCsv = "C:\Users\gregc\vi-clean\data\vehicles_v2.csv"
)
$ErrorActionPreference = "Stop"

$imgs = Get-ChildItem -Path $ImagesDir -Include *.jpg,*.jpeg,*.png -File | Select-Object -ExpandProperty FullName
if (-not $imgs -or $imgs.Count -eq 0) { throw "No images found in $ImagesDir" }

# CSV wants ; separated paths with backslashes doubled
$imagesField = ($imgs -join ";").Replace("\","\\")
$header = "vehicleId,pdf,images"
$row    = "$VehicleId,$PdfPath,""`"$imagesField`"""

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutCsv) | Out-Null
if (!(Test-Path $OutCsv)) { $header | Set-Content -Encoding UTF8 $OutCsv }
Add-Content -Encoding UTF8 $OutCsv $row

Write-Host "Wrote row for $VehicleId to $OutCsv"
