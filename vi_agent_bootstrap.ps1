# vi_agent_bootstrap.ps1
# Creates a Windows-first local agent + Sprint 3..10 plans (no zips, no downloads).

$ErrorActionPreference = "Stop"
$root = Join-Path $env:USERPROFILE "Downloads\vi-agent-local"  # change if you prefer
Write-Host "Creating $root ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $root | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root "scripts\deploy") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root "scripts\utils") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root "agent_runs") | Out-Null

function W($relPath, [string]$content) {
  $full = Join-Path $root $relPath
  New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
  $content | Out-File -FilePath $full -Encoding utf8
  Write-Host "  wrote $relPath"
}

# ========== agent.ps1 ==========
W "agent.ps1" @'
param(
  [string]$SprintFile = "SPRINT_3_PLAN.md",
  [string]$Backlog = "BACKLOG.md",
  [string]$Config = "sprint.config.yaml",
  [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ProjectDir = (Get-Location).Path
$SprintPath = Join-Path $ProjectDir $SprintFile
$BacklogPath = if (Test-Path $Backlog) { Join-Path $ProjectDir $Backlog } else { $null }
$ConfigPath = Join-Path $ProjectDir $Config

if (!(Test-Path $SprintPath)) { throw "Sprint file not found: $SprintPath" }
if (!(Test-Path $ConfigPath)) { throw "Config file not found: $ConfigPath" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 18+ required (install from nodejs.org)" }
if (-not (Test-Path (Join-Path $PSScriptRoot "package.json"))) {
  Push-Location $PSScriptRoot
  npm init -y | Out-Null
  npm pkg set type="module" | Out-Null
  npm i yaml@2.5.1 | Out-Null
  Pop-Location
}

$node = "node"
$dry = if ($DryRun) { "--dry" } else { "" }
$cmd = @($node, (Join-Path $PSScriptRoot "agent.mjs"), "--sprint", $SprintPath, "--backlog", $BacklogPath, "--config", $ConfigPath, $dry) | Where-Object { $_ -and $_ -ne "" }

Write-Host "▶ Running local agent..." -ForegroundColor Cyan
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cmd[0]
$psi.ArgumentList = $cmd[1..($cmd.Count-1)]
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$null = $proc.Start()
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

$runDir = Join-Path $ProjectDir "agent_runs"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$logBase = Join-Path $runDir "run_$ts"
$stdout | Out-File -FilePath ($logBase + "_stdout.log") -Encoding utf8
$stderr | Out-File -FilePath ($logBase + "_stderr.log") -Encoding utf8

if ($proc.ExitCode -ne 0) {
  Write-Host "✖ Agent failed. See logs:" -ForegroundColor Red
  Write-Host "$logBase*_*.log"
  exit $proc.ExitCode
}

Write-Host "✔ Agent completed. Logs -> $logBase*_*.log" -ForegroundColor Green
'@

# ========== agent.mjs (fixed, no await import) ==========
W "agent.mjs" @'
#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import * as yaml from "yaml";

function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p,s){ fs.writeFileSync(p, s, "utf8"); }
function exists(p){ return fs.existsSync(p); }

function parseArgs(){
  const a = process.argv.slice(2); const o = {};
  for (let i=0;i<a.length;i++){
    const k = a[i];
    if (k==="--sprint") o.sprint = a[++i];
    else if (k==="--backlog") o.backlog = a[++i];
    else if (k==="--config") o.config = a[++i];
    else if (k==="--dry") o.dry = true;
  }
  if (!o.sprint || !o.config){ console.error("Missing --sprint or --config"); process.exit(2); }
  return o;
}

function extractTasks(md){
  const tasks = [];
  md.split(/\r?\n/).forEach(line=>{
    const m = /^\s*-\s*\[( |x|X)\]\s*(.+)$/.exec(line);
    if (m){ tasks.push({done: m[1].toLowerCase()==="x", text: m[2].trim(), raw: line}); }
  });
  return tasks;
}

function runCmd(cmd, cwd){
  const res = spawnSync(cmd, { shell:true, cwd, stdio:"inherit" });
  return res.status ?? 1;
}

function markDone(lines, raw){
  const idx = lines.indexOf(raw);
  if (idx>=0) lines[idx] = raw.replace("- [ ]","- [x]");
}

function makeSummary(runlog){
  const ok = runlog.filter(r=>r.status==="ok").length;
  const fail = runlog.some(r=>r.status==="fail");
  return `Tasks executed: ${runlog.length}\nSucceeded: ${ok}\nFailed: ${fail?1:0}`;
}

function main(){
  const a = parseArgs();
  const sprintPath = path.resolve(a.sprint);
  const projectDir = path.dirname(sprintPath);
  const config = yaml.parse(read(path.resolve(a.config)));
  const rules = config.rules || [];
  const md = read(sprintPath);
  const lines = md.split(/\r?\n/);
  const tasks = extractTasks(md);

  const runDir = path.join(projectDir, "agent_runs");
  fs.mkdirSync(runDir, {recursive:true});
  const log = [];
  console.log(`↯ Sprint: ${sprintPath}`);
  console.log(`↯ Total tasks: ${tasks.length}`);

  for (const t of tasks){
    if (t.done) continue;
    const rule = rules.find(r=> t.text.toLowerCase().includes(r.when.toLowerCase()));
    if (!rule){ console.log(`• SKIP (no rule): ${t.text}`); log.push({task:t.text,status:"skipped"}); continue; }
    console.log(`• RUN: ${t.text}\n  $ ${rule.run}`);
    if (a.dry){ log.push({task:t.text,status:"dry",cmd:rule.run}); continue; }
    const code = runCmd(rule.run, projectDir);
    log.push({task:t.text,status:(code===0?"ok":"fail"),code,cmd:rule.run,at:new Date().toISOString()});
    if (code===0) markDone(lines, t.raw); else break;
  }

  if (!a.dry) write(sprintPath, lines.join("\n"));
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  write(path.join(runDir, `run_${stamp}.jsonl`), JSON.stringify({sprint:path.basename(sprintPath),log})+"\n");
  write(sprintPath, read(sprintPath)+`\n\n---\n## Run Summary (${new Date().toLocaleString()})\n\n${makeSummary(log)}\n`);
  process.exit(log.some(r=>r.status==="fail")?1:0);
}
main();
'@

# ========== sprint.config.yaml (Windows-first; point "build app" to your assemble.ps1) ==========
W "sprint.config.yaml" @'
rules:
  - when: "seed firestore"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\deploy\\seed-firestore.ps1"
  - when: "deploy functions"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\deploy\\deploy-functions.ps1"
  - when: "build app"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\assemble.ps1"
  - when: "publish release bundle"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\deploy\\publish.ps1"
  - when: "add smoke tests"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\deploy\\run-smoke-tests.ps1"
  - when: "configure failure notifications"
    run: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\deploy\\notify-setup.ps1"
'@

# ========== README ==========
W "README_LOCAL_AGENT.md" @'
# VI Local Agent (Windows-first)
1) Install Node.js 18+ and (optional) Firebase CLI (`npm i -g firebase-tools` if deploying functions).
2) Put this folder at your project root (next to SPRINT_1_PLAN.md, assemble.ps1, etc.).
3) Run: `./agent.ps1 -SprintFile 'SPRINT_3_PLAN.md' -DryRun:$false`
4) The agent checks off completed tasks, appends a Run Summary, and writes logs to `./agent_runs/`.
Edit `sprint.config.yaml` to map phrases → your real scripts.
'@

# ========== Deploy script stubs ==========
W "scripts/deploy/seed-firestore.ps1" @'
$ErrorActionPreference = "Stop"
Write-Host "Seeding Firestore (stub)..." -ForegroundColor Cyan
# Example:
# $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\keys\admin.json"
# node .\vi-seeder\seed_manual_chunks.mjs --vehicleKey=honda/cr-v/2020/ex --in=.\out\crv2020.txt
Start-Sleep -Seconds 1
'@

W "scripts/deploy/deploy-functions.ps1" @'
$ErrorActionPreference = "Stop"
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { throw "Install Firebase CLI: npm i -g firebase-tools" }
$project = if ($env:FIREBASE_PROJECT) { $env:FIREBASE_PROJECT } else { "vehicle-instructions-app" }
Write-Host "Deploying Functions to $project ..." -ForegroundColor Cyan
firebase use $project
firebase deploy --only functions
'@

W "scripts/deploy/build-app.ps1" @'
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".\app\package.json")) { Write-Host "No app/package.json; skipping." -ForegroundColor Yellow; exit 0 }
Push-Location .\app
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm required." }
npm ci
npm run build 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "Build script not found; trying expo export"; npx expo export }
Pop-Location
'@

W "scripts/deploy/publish.ps1" @'
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$out = "VehicleInstructions_release_$stamp"
Write-Host "Publishing (stub) -> $out" -ForegroundColor Cyan
# Implement: copy build output to a share or GCS bucket, etc.
Start-Sleep -Seconds 1
'@

W "scripts/deploy/run-smoke-tests.ps1" @'
$ErrorActionPreference = "Stop"
Write-Host "Running smoke tests (stub)..." -ForegroundColor Cyan
# Example: node .\scripts\schema_check.mjs; curl your functions health endpoint
Start-Sleep -Seconds 1
'@

W "scripts/deploy/notify-setup.ps1" @'
$ErrorActionPreference = "Stop"
Write-Host "Notification wiring placeholder (email/Teams). Configure later." -ForegroundColor Yellow
'@

# ========== Sprint Plans 3..10 ==========
W "SPRINT_3_PLAN.md" @'
# Sprint 3 (2 weeks)
**Goal:** Automate builds & agent runs locally; no babysitting.

## Tasks
- [ ] Seed Firestore for 3+ vehicles                         <!-- phrase: seed firestore -->
- [ ] Deploy Functions to vehicle-instructions-app           <!-- phrase: deploy functions -->
- [ ] Build app (Expo or RN web)                             <!-- phrase: build app -->
- [ ] Publish release bundle                                  <!-- phrase: publish release bundle -->
- [ ] Add smoke tests (doc counts, function health)           <!-- phrase: add smoke tests -->
- [ ] Configure failure notifications (placeholder)           <!-- phrase: configure failure notifications -->

## Acceptance Criteria
- Agent completes end-to-end locally without prompts
- Logs saved to ./agent_runs and tasks are checked
- Smoke tests pass; failures are reported
'@

W "SPRINT_4_PLAN.md" @'
# Sprint 4 (2 weeks)
**Goal:** Data quality & ingestion repeatability.

## Tasks
- [ ] Validate chunker rules (min/max tokens, headings)
- [ ] Add OEM parser plug-ins (Honda, Toyota, Ford) v1
- [ ] Re-seed Firestore for 5 additional vehicles             <!-- phrase: seed firestore -->
- [ ] Content QA checks (missing images, malformed steps)
- [ ] Integrate ElevenLabs narration stub
- [ ] Build app with revised content model                     <!-- phrase: build app -->
- [ ] Publish release bundle                                   <!-- phrase: publish release bundle -->

## Acceptance Criteria
- QA report shows zero critical content errors
- App renders ≥8 models with consistent UX
'@

W "SPRINT_5_PLAN.md" @'
# Sprint 5 (3 weeks)
**Goal:** Admin UI & security for pilot readiness.

## Tasks
- [ ] Admin UI (upload manual, map metadata, trigger ingest)
- [ ] Role-based access (Admin, Editor, Viewer)
- [ ] Firestore security rules hardened + tests
- [ ] Cost/perf baseline (reads/writes, cold starts)
- [ ] Canary deploy + rollback script                          <!-- phrase: deploy functions -->
- [ ] Build & publish release                                  <!-- phrase: build app / publish release bundle -->

## Acceptance Criteria
- Admin uploads a manual -> live in app ≤1 day
- Security tests pass; baseline logged
'@

W "SPRINT_6_PLAN.md" @'
# Sprint 6 (3–4 weeks)
**Goal:** Private pilots + traction for funding pitch.

## Tasks
- [ ] Deploy pilot env for 3–5 dealerships
- [ ] Deploy pilot env for 1–2 rental companies
- [ ] Collect pilot feedback + usage analytics
- [ ] Deeper analytics (completion, search frequency)
- [ ] Landing page + beta sign-up
- [ ] Monetization options (free vs. one-time unlock vs. subscription)

## Acceptance Criteria
- ≥3 dealerships + ≥2 rentals active
- 1,000+ end users onboarded
- Feedback doc + fixes prioritized
'@

W "SPRINT_7_PLAN.md" @'
# Sprint 7 (3 weeks)
**Goal:** Scale ingestion to dozens of models; payments; YouTube.

## Tasks
- [ ] Ingest 50–100 additional vehicles                        <!-- phrase: seed firestore -->
- [ ] Optimize seeder + storage costs
- [ ] Implement payments (one-time unlocks)
- [ ] YouTube publishing pipeline active
- [ ] A/B test: one-time vs. subscription
- [ ] Revenue/engagement analytics dashboards

## Acceptance Criteria
- ≥50 models live
- Payments working; first revenue recorded
- YouTube pipeline producing views
'@

W "SPRINT_8_PLAN.md" @'
# Sprint 8 (3 weeks)
**Goal:** Monetization & OEM credibility.

## Tasks
- [ ] OEM certification outreach
- [ ] ASE/official mechanic certification process
- [ ] Finalize revenue model (ads, unlocks, OEM)
- [ ] Expand to 250 models
- [ ] VIN scanner onboarding
- [ ] Moderated community Q&A

## Acceptance Criteria
- ≥250 models live
- First certification in progress
'@

W "SPRINT_9_PLAN.md" @'
# Sprint 9 (4 weeks)
**Goal:** Partnerships & scale to 1,000 models.

## Tasks
- [ ] Expand to 1,000 models                                   <!-- phrase: seed firestore -->
- [ ] Sign OEM pilot agreement
- [ ] Sign insurance/dealer group contract
- [ ] Global readiness (CDN, translations)
- [ ] AR overlay prototype (point at car part)
- [ ] Compliance (GDPR/CCPA)

## Acceptance Criteria
- ≥1,000 models live
- ≥1 OEM + ≥1 insurance/dealer contract
'@

W "SPRINT_10_PLAN.md" @'
# Sprint 10 (4+ weeks)
**Goal:** Household name.

## Tasks
- [ ] Global launch (US/EU/Asia)
- [ ] App stores worldwide
- [ ] 3–5 OEM certifications
- [ ] Partnerships: insurers, rentals, dealerships
- [ ] PR/influencer campaign
- [ ] 5,000+ models supported
- [ ] AI chatbot + personalized maintenance

## Acceptance Criteria
- ≥10M users
- OEM certification logos in-app
- Strong press and community adoption
'@

Write-Host "`nDONE. Files created at: $root" -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  1) cd `"$root`""
Write-Host "  2) ./agent.ps1 -SprintFile 'SPRINT_3_PLAN.md' -DryRun:`$false"
