# Vehicle Instructions App — Sprint 2 Reference
**Purpose:** Quick guide to set up, run, and validate multi‑vehicle ingestion for Sprint 2.

## 1) Setup (One‑Time)
1. Install prerequisites: Node 18+, Python 3.11+, FFmpeg, Firebase CLI.
2. Copy `.env.template` → `.env` and fill values.
3. Place service account at `./keys/admin.json` and set `GOOGLE_APPLICATION_CREDENTIALS`.
4. Run the one‑click:
   - Windows: `./assemble.ps1`
   - macOS/Linux: `./assemble.sh`

If anything fails, see **Preflight Checks** below.

## 2) Process a Vehicle
```powershell
# Example: Honda CR-V 2020
node scripts/pipeline.mjs --vehicle honda/cr-v/2020 --pdf ./manuals/crv2020.pdf --images ./images/crv2020
```
This will:
- Extract manual text → generate per‑section scripts
- Create MP3s (TTS)
- Build per‑section MP4s + a concatenated full.mp4
- Write Firestore docs & upload to Storage

## 3) Verify in the App
- Open Expo app → search **CR‑V 2020** → open details
- Play **Full Video** and **per‑section videos**
- Confirm loading/error states behave as expected

## 4) Add Two More Vehicles
Repeat **Process a Vehicle** for 2 additional models. Aim for different makes/years.

## 5) Pilot Checklist (Pass/Fail)
- [ ] 3 vehicles present in search
- [ ] All sections playable
- [ ] Full video playable
- [ ] Metadata (make/model/year/trim) correct
- [ ] No missing assets (script/audio/video/image)
- [ ] README alone was sufficient to complete tasks

## Preflight Checks (Common Issues)
- **Firebase CLI** not found → `npm i -g firebase-tools`
- **FFmpeg** not found → install and confirm on PATH (`ffmpeg -version`)
- **Service account** missing or invalid → confirm path in `.env`
- **ELEVENLABS_API_KEY** not set → export or add to `.env`

## File Structure (Reference)
```
/app
/functions
/scripts
  pipeline.mjs
  schema_check.mjs
/manuals
/images
/keys
/config
  .secrets.ps1
  .secrets.sh
/logs
```

## Support
Capture errors + command output and attach the log in `/logs`. Create an issue in `BACKLOG.md` with label(s): `[pipeline] [ui] [content] [env]`.
