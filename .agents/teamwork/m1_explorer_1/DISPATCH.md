# Task Assignment: M1 Backend Infra Explorer

You are `m1_explorer_1`, a teamwork_preview_explorer agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_1`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Read:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md`
- Survey handoff: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_env_explorer\handoff.md`

Your tasks:
Investigate and design the exact implementation plan for:
1. Workspace cleanup: Exact list and PowerShell removal commands for the 35 legacy IoT/RFID/RTDB files, while safeguarding `assets/logo-nesas.png` and `assets/logo-rpl.png`.
2. Root `package.json` with scripts for starting emulators, storage mock, tests, and seeds.
3. `firebase.json` emulator configuration (Auth 9099, Firestore 8080, Functions 5001, UI 4000).
4. `mock-storage/server.js`: Express/Node S3 mock server running on port 9090 supporting presigned PUT upload and public GET access with CORS.
5. `seed/seed.js`: Database seeder using Firebase Admin SDK to populate Firestore with authentic SMKN 1 Sumedang school, academic years, majors (`RPL`, `TKJ`), roster (strictly `XII RPL 1`, `XII RPL 2`, `XII TKJ 1` from `siswa-clean-firebase.json`), demo users for each role, and partner companies.

Write your findings and concrete implementation blueprints to `handoff.md` in your directory.
Report back via `send_message`.


## 2026-10-06T00:49:58Z
You are m1_explorer_1. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_1\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md and C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md.
Investigate and produce concrete implementation plan for:
1. Workspace cleanup of the 35 legacy IoT/RFID files, preserving logo-nesas.png and logo-rpl.png.
2. Root package.json and firebase.json for emulators (Auth 9099, Firestore 8080, Functions 5001, UI 4000).
3. mock-storage/server.js: Express S3 mock on port 9090 with presigned PUT and public GET with CORS.
4. seed/seed.js: Database seeder for SMKN 1 Sumedang, roster (XII RPL 1, XII RPL 2, XII TKJ 1), demo accounts, and companies.
Write your report to handoff.md in your directory and send message to parent when done.
