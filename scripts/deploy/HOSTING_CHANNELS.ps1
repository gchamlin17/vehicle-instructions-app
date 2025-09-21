$ErrorActionPreference="Stop"
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { throw "Install Firebase CLI: npm i -g firebase-tools" }
# Deploy to preview channels (dev/staging) then promote to live (prod)
firebase hosting:channel:deploy dev --expires 7d
firebase hosting:channel:deploy staging --expires 14d
# If you want to cut live:
firebase deploy --only hosting
Write-Host "Dev/Staging channels deployed; live hosting deployed." -ForegroundColor Green
