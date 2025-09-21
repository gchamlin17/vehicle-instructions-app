param([switch]$Verbose)
$ErrorActionPreference="Stop"
Write-Host "== Preflight ==" -ForegroundColor Cyan
foreach($v in "OPENAI_API_KEY","ELEVENLABS_API_KEY","FIREBASE_STORAGE_BUCKET","GOOGLE_APPLICATION_CREDENTIALS"){
 if(-not $env:$v){ Write-Host "[FAIL] Missing $v" -ForegroundColor Red; $fail=$true } else { Write-Host "[OK] $v" -ForegroundColor Green }
}
if($fail){ exit 2 } else { Write-Host "== Preflight OK ==" -ForegroundColor Cyan }
