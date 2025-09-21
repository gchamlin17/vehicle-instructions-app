param(
  [string]$QueueDir = "C:\Users\gregc\vi-clean\queue",
  [string]$OutDir   = "C:\Users\gregc\vi-clean\dist\pipeline-output",
  [string]$Ffmpeg   = "C:\Users\gregc\vi-clean\ffmpeg\ffmpeg\bin\ffmpeg.exe",
  [string]$Model    = "gpt-4o"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $QueueDir | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir   | Out-Null

Write-Host "[queue] Watching $QueueDir for *.csv (v2 schema)" -ForegroundColor Cyan
$fsw = New-Object System.IO.FileSystemWatcher $QueueDir, "*.csv"
$fsw.EnableRaisingEvents = $true
Register-ObjectEvent $fsw Created -Action {
  Start-Sleep -Seconds 1
  $csv = $Event.SourceEventArgs.FullPath
  try {
    Write-Host "[queue] Processing $csv" -ForegroundColor Magenta
    & powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\gregc\vi-clean\scripts\run_batch_v2.ps1" -CsvPath $csv -OutDir $using:OutDir -Ffmpeg $using:Ffmpeg -Model $using:Model
    Rename-Item -Path $csv -NewName ($csv + ".done")
  } catch {
    Write-Host "[queue] Error: $($_.Exception.Message)" -ForegroundColor Red
    Rename-Item -Path $csv -NewName ($csv + ".error.csv")
  }
}
while ($true) { Start-Sleep -Seconds 2 }
