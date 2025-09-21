param([string]$OrgId="household:test",[string]$Vehicle="honda/cr-v/2020/ex",[string]$Bucket="")
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$target = Join-Path ".\data\sample_videos" (Join-Path $OrgId $Vehicle)
New-Item -ItemType Directory -Force -Path (Join-Path $target "videos"), (Join-Path $target "captions"), (Join-Path $target "manifests") | Out-Null

# write a tiny manifest
$manifest = @{
  version=1; orgId=$OrgId; vehicleKey=$Vehicle;
  clips=@(
    @{id="tpms-reset"; title="Reset TPMS"; src="videos/tpms-reset.mp4"; caption="captions/tpms-reset.vtt"}
  )
} | ConvertTo-Json -Depth 6
$mf = Join-Path $target "manifests\videos.json"
$manifest | Set-Content -Path $mf -Encoding UTF8

Write-Host ("Local manifest created at: "+$mf) -ForegroundColor Green

# Upload to bucket if gsutil available + bucket provided
$gsutil = (where.exe gsutil 2>$null | Select-Object -First 1)
if ($Bucket -and $gsutil) {
  $prefix = ("gs://{0}/{1}/{2}" -f $Bucket, $OrgId, $Vehicle)
  & $gsutil cp -r "$target\*" "$prefix/"
  Write-Host ("Uploaded to "+$prefix) -ForegroundColor Green
} else {
  Write-Host "Skipping upload (no gsutil or bucket not provided)." -ForegroundColor Yellow
}
