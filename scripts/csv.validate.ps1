param([Parameter(Mandatory=$true)][string]$CsvPath)
$ErrorActionPreference="Stop"
if(!(Test-Path $CsvPath)){ throw "CSV not found: $CsvPath" }
$rows=Import-Csv $CsvPath
if(@($rows).Count -eq 0){ throw "CSV has zero rows" }
Write-Host "[CSV] OK: $(@($rows).Count) rows" -ForegroundColor Green
