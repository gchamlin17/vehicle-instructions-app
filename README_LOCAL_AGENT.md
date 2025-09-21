# VI Local Agent (Windows-first)
1) Install Node.js 18+ and (optional) Firebase CLI (`npm i -g firebase-tools` if deploying functions).
2) Put this folder at your project root (next to SPRINT_1_PLAN.md, assemble.ps1, etc.).
3) Run: `./agent.ps1 -SprintFile 'SPRINT_3_PLAN.md' -DryRun:$false`
4) The agent checks off completed tasks, appends a Run Summary, and writes logs to `./agent_runs/`.
Edit `sprint.config.yaml` to map phrases â†’ your real scripts.
