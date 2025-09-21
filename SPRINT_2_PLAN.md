# Sprint 2 Plan — Vehicle Instructions App
**Dates:** TBD (2 weeks)  
**Goal:** Harden the pipeline and app for **multi-vehicle ingestion (≥3 vehicles)** with reliable data storage, repeatable scripts, and a polished user flow with video generation.

---

## Outcomes & Definition of Done (DoD)
- **Ingestion:** 3 distinct vehicles (e.g., `honda/cr-v/2020`, `toyota/rav4/2021`, `ford/escape/2019`) processed end‑to‑end (PDF → script → TTS → video → app playback).
- **Reliability:** All one‑click scripts complete without manual edits on a clean machine (Windows & macOS/Linux).
- **Data Model:** Firestore schema implemented & documented (vehicles → scripts → audio → video); storage paths deterministic and validated.
- **UI/UX:** Search → select vehicle → view details → play **full** and **per‑section** videos, with loading/error states.
- **Docs:** Setup/readme and runbook updated; teammate can replicate without prior context.
- **Metrics:** Basic telemetry (video completion placeholder + manual checklist) captured for pilot readiness.

---

## Workstreams & Tasks

### 1) Environment, Keys & Scripts (Days 1–3)
- Consolidate environment into `/.env` + `/.env.local` (RN/Next.js) and `config/.secrets.ps1` (PowerShell) and `config/.secrets.sh` (bash).
- Add **preflight checks** to `assemble.ps1` / `assemble.sh`:
  - Firebase CLI present
  - `GOOGLE_APPLICATION_CREDENTIALS` file exists and is JSON
  - ElevenLabs API key present
  - FFmpeg available and on PATH
- Fail fast with clear messages + exit codes. Write logs to `./logs/assemble-YYYY-MM-DD.log`.
- Add **idempotent seeding**: safe upserts, skip if asset exists unless `--force`.

**Acceptance Criteria**
- Running `./assemble.ps1` or `./assemble.sh` on a clean machine completes without editing files mid-run.
- Missing dependency produces actionable error and link to fix.

---

### 2) Firestore Schema & Storage Layout (Days 2–5)
- Finalize schema (see Appendix A) and implement validators in seeding scripts.
- Use canonical key: `{make}/{model}/{year}` (lowercase, hyphenless model where feasible).
- Write a **schema contract** checker: validates required fields for each vehicle and section.
- Storage paths (Firebase Storage):
  - `videos/{make}/{model}/{year}/full.mp4`
  - `videos/{make}/{model}/{year}/{section}.mp4`
  - `audio/{make}/{model}/{year}/{section}.mp3`
  - `images/{make}/{model}/{year}/{section}.jpg`

**Acceptance Criteria**
- `scripts/schema_check.mjs` passes for all seeded vehicles.
- Attempted invalid write is rejected with a human‑readable error.

---

### 3) Ingestion Worker & Pipeline (Days 4–9)
- **PDF ingestion worker** (Node or Python) that:
  - Accepts a local path or URL
  - Extracts text (PyMuPDF)
  - Chunks → prompts LLM for *8–10 min friendly script* per section
  - Saves script text to Firestore
- **TTS (ElevenLabs primary, Google TTS fallback)**:
  - Generate MP3 per section with deterministic filenames
- **Video assembler (FFmpeg)**:
  - Loop section image(s) over narration to produce `{section}.mp4`
  - Concat sections into `full.mp4` using a manifest list
  - Optional: burn subtitles from auto‑generated SRT

**Acceptance Criteria**
- CLI: `node scripts/pipeline.mjs --vehicle honda/cr-v/2020 --pdf ./manuals/crv2020.pdf --images ./images/crv2020`
- Produces: scripts, audio, section videos, full video, Firestore docs, and Storage assets.

---

### 4) UI/UX Hardening (Days 8–12)
- **Search screen**: Make/model/year query with debounce; shows count and thumbnails.
- **Detail screen**: Vehicle metadata, section list, “Play full”, individual section playback.
- **States**: loading, empty, error; retry affordance.
- **Next.js web**: parity demo (search → detail → playback).

**Acceptance Criteria**
- On device and web, user can discover all three vehicles and play both full and per‑section videos.

---

### 5) Content & Pilot Prep (Days 12–14)
- Ingest **3 manuals** end‑to‑end and publish assets.
- Create **demo script** and **pilot checklist**.
- Document known issues & workarounds.

**Acceptance Criteria**
- Teammate runs the demo without help using README and scripts.
- Pilot checklist completed with green status on core items.

---

## Risks & Mitigations
- **Manual text quality varies** → add fallback OCR or section heuristics.
- **TTS quota/cost** → batch, cache, and allow provider toggle; track minutes.
- **FFmpeg on Windows path issues** → detect and guide install; ship portable FFmpeg or configure PATH.
- **File‑saving/user error** → preflight checks, explicit output directories, and post‑run summary with next steps.

---

## Communication & Cadence
- **Stand‑up**: Daily 10 min; **Demo**: end of week 1 (1–2 vehicles), end of week 2 (3 vehicles).
- **Issue tracking**: `BACKLOG.md` + labels `[pipeline] [ui] [content] [env]`.
- **Change log**: update `CHANGELOG.md` per commit or task completion.

---

## Appendices

### Appendix A — Firestore Schema (JSON shape)
```json
{
  "vehicles": {
    "{make}/{model}/{year}": {
      "make": "honda",
      "model": "cr-v",
      "year": 2020,
      "trim": "ex",
      "createdAt": 0,
      "updatedAt": 0,
      "sections": {
        "intro": {
          "script": "string",
          "audioUrl": "gs://.../audio/intro.mp3",
          "videoUrl": "gs://.../videos/intro.mp4",
          "imageUrl": "gs://.../images/intro.jpg",
          "durationSec": 0
        },
        "safety": { "script": "...", "audioUrl": "...", "videoUrl": "...", "imageUrl": "...", "durationSec": 0 }
      },
      "fullVideoUrl": "gs://.../videos/full.mp4",
      "available": true
    }
  }
}
```

### Appendix B — .env.template
```
# Firebase
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./keys/admin.json

# TTS
ELEVENLABS_API_KEY=

# OpenAI / LLM
OPENAI_API_KEY=

# Paths
FFMPEG_PATH=ffmpeg   # or absolute path if needed
ASSETS_DIR=./assets
```

### Appendix C — FFmpeg Snippets
```bash
# Section video from single image + mp3
ffmpeg -y -loop 1 -framerate 30 -i image.jpg -i narration.mp3 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest section.mp4

# Concat sections (create sections.txt with "file 'intro.mp4'\nfile 'safety.mp4'...")
ffmpeg -y -f concat -safe 0 -i sections.txt -c copy full.mp4

# Burn subtitles (optional)
ffmpeg -y -i section.mp4 -vf subtitles=section.srt -c:a copy section_subtitled.mp4
```

### Appendix D — Preflight Checks (PowerShell pseudocode)
```powershell
$errors = @()
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {{ $errors += "Firebase CLI missing. Install: npm i -g firebase-tools" }}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {{ $errors += "FFmpeg missing. Install and add to PATH." }}
if (-not (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)) {{ $errors += "GOOGLE_APPLICATION_CREDENTIALS not found." }}
if (-not $env:ELEVENLABS_API_KEY) {{ $errors += "ELEVENLABS_API_KEY not set." }}
if ($errors.Count -gt 0) {{ $errors | ForEach-Object {{ Write-Host "❌ $_" -ForegroundColor Red }}; exit 1 }}
Write-Host "✅ Preflight passed" -ForegroundColor Green
```

---

**Owner:** Sprint Lead  
**Reviewers:** UI Lead, Pipeline Lead, Pilot Coordinator


---
## Run Summary (9/21/2025, 3:04:24 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0


---
## Run Summary (9/21/2025, 3:04:48 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0


---
## Run Summary (9/21/2025, 3:31:50 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0


---
## Run Summary (9/21/2025, 4:07:04 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0


---
## Run Summary (9/21/2025, 4:11:35 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0


---
## Run Summary (9/21/2025, 4:29:01 AM)

Tasks executed: 0
Succeeded: 0
Failed: 0
