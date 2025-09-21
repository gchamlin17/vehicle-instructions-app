param([Parameter(Mandatory=$true)][string]$CsvPath,
      [string]$OutDir="C:\Users\gregc\vi-clean\dist\pipeline-output",
      [string]$Model="gpt-4o",
      [string]$Ffmpeg=$env:FFMPEG_EXE)
$ErrorActionPreference="Stop"; $VerbosePreference="Continue"
.\scripts\csv.validate.ps1 -CsvPath $CsvPath
$rows=Import-Csv $CsvPath; $count=@($rows).Count
Write-Host "[batch] Rows=$count OutDir=$OutDir" -ForegroundColor Cyan
foreach($r in $rows){
  $vid=$r.vehicleId; $pdf=$r.pdf; $imgs=$r.images
  $args=@("--pdf",$pdf,"--images",$imgs,"--output",$OutDir,"--vehicle",$vid,"--model",$Model,"--ffmpeg",$Ffmpeg)
  Write-Host "[run] $vid" -ForegroundColor Green
  & py .\scripts\pipeline_v3.py @args 2>&1 | Write-Host
  if($LASTEXITCODE -eq 0 -and (Test-Path "$OutDir\$vid`_video.mp4")){
    if(Test-Path ".\scripts\upload_to_firebase_v2.js"){ node .\scripts\upload_to_firebase_v2.js $vid $OutDir | Write-Host }
  } else { Write-Host "[miss] $vid video not found" -ForegroundColor Yellow }
}
