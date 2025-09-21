$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$ok = $true
function say($t,$k){ $c=@{ok="Green";warn="Yellow";err="Red"}[$k]; if(-not $c){$c="Gray"}; $fc=$Host.UI.RawUI.ForegroundColor;$Host.UI.RawUI.ForegroundColor=$c;Write-Host $t;$Host.UI.RawUI.ForegroundColor=$fc }

try { $node=(node -v); say ("Node: "+$node) "ok" } catch { say "Node: MISSING" "err"; $ok=$false }
try { $npm=(npm -v); say ("npm: "+$npm) "ok" } catch { say "npm: MISSING" "err"; $ok=$false }
try { $fb=(firebase --version); say ("Firebase CLI: "+$fb) "ok" } catch { say "Firebase CLI: MISSING (npm i -g firebase-tools)" "warn" }
try { $npx=(npx --version); say ("npx: "+$npx) "ok" } catch { say "npx: MISSING" "warn" }

if (Test-Path ".\functions\package.json") { say "functions/ detected" "ok" } else { say "functions/: missing (will be created by previous packs)" "warn" }
if (Test-Path ".\app\package.json")       { say "app/ frontend detected" "ok" } else { say "app/: missing" "warn" }

if (Test-Path ".\firebase.json") { say "firebase.json present" "ok" } else { say "firebase.json missing" "err"; $ok=$false }
if (Test-Path ".\.firebaserc")   { say ".firebaserc present" "ok" } else { say ".firebaserc missing" "warn" }

say ("Agent flags: mode="+(Get-Content .\AGENT_MODE.flag -Raw 2>$null)," queue="+(Get-Content .\AGENT_QUEUE_MODE.flag -Raw 2>$null)) "ok"
if (-not $ok) { exit 1 } else { exit 0 }
