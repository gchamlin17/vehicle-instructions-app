$ErrorActionPreference='Stop'
if(-not (Get-Command firebase -ErrorAction SilentlyContinue)){ throw "Install Firebase CLI: npm i -g firebase-tools" }
$env:CI='1'
firebase deploy --only firestore:rules --non-interactive
firebase deploy --only storage --non-interactive
firebase deploy --only functions --non-interactive
if (Test-Path ".\app\web-dist") { firebase deploy --only hosting --non-interactive }
