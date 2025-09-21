# Sprint 2 Agent Bundle

## New CSV schema
`data\vehicles_v2.csv`
```csv
vehicleId,pdf,images
camry-2025,C:\Users\gregc\vi-clean\sample_manual.pdf,"C:\\img1.jpg;C:\\img2.jpg;C:\\img3.jpg"
```

## Commands (PowerShell)
```powershell
cd C:\Users\gregc\vi-clean
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\env.from-keys.ps1

# Process a CSV with multi-segment images
.\scripts\run_batch_v2.ps1 -CsvPath "C:\Users\gregc\vi-clean\data\vehicles_v2.csv"

# Queue watcher (drop v2 CSVs into \queue)
.\scripts\agent.loop_v2.ps1
```

## What pipeline_v3 does
- Extracts PDF text (PyMuPDF)
- Summarizes to narration (OpenAI)
- Splits narration into N segments based on your images list
- Generates TTS per segment (ElevenLabs)
- Builds per-segment videos and concatenates into a final MP4 (FFmpeg)
- Emits a manifest JSON with segments; uploader writes `segments[]` to Firestore

## Admin UI stub
- `admin/pages/vehicles/[id].tsx` shows a Chapters list and seeks into the video proportionally by segment index.
- Replace proportional seeking with real timestamps if you want more precision (next iteration can probe durations).
