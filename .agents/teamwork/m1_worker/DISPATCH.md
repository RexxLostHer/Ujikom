# Task Assignment: M1 Implementation Worker

You are `m1_worker`, a teamwork_preview_worker agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_worker`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & File Ownership
You exclusively own:
- Legacy workspace cleanup (removing 35 files, strictly safeguarding `assets/logo-nesas.png`, `assets/logo-rpl.png`, `assets/foto/`).
- Root `package.json`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.
- `mock-storage/server.js`.
- `seed/seed.js` and `seed/roster-data.json`.
- `functions/` (TypeScript functions, callables, triggers, helpers, unit tests).
- `rules-tests/` (@firebase/rules-unit-testing suite).

You do NOT touch `vokalog_app/` or `e2e/`.

## Authoritative Inputs to Read
Before coding, read the detailed implementation blueprints from the 3 explorers:
1. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_1\handoff.md` (Cleanup, package.json, firebase.json, mock-storage, seed script)
2. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_2\handoff.md` (Full TypeScript code for Cloud Functions, triggers, helpers, and unit tests)
3. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_3\handoff.md` (Full `firestore.rules` and `@firebase/rules-unit-testing` test suite)

## Implementation Steps
1. Migrate `siswa-clean-firebase.json` to `seed/roster-data.json`.
2. Clean up the 35 legacy files/directories (`iot/`, `tests/`, `scripts/`, `presensi-live.*`, legacy html/js/css in root and `assets/`). Safeguard `assets/logo-nesas.png` and `assets/logo-rpl.png`.
3. Create `package.json`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.
4. Create `mock-storage/server.js` (Express S3 mock on port 9090).
5. Create `seed/seed.js` using `firebase-admin` and authentic SMKN 1 Sumedang data (`XII RPL 1`, `XII RPL 2`, `XII TKJ 1`).
6. Build `functions/` TypeScript project (package.json, tsconfig.json, callables: lookupNisn, completeRegistration, getUploadUrl; triggers: verifyAttendance, verifyCheckout, onLogbookCreated, onLogbookReviewed, onApplicationDecided, onAssessmentFinalized, onSosStatusChanged, markAbsentees; helpers: geo.ts, notify.ts, r2.ts, admin.ts).
7. Create functions unit tests in `functions/test/`.
8. Create `rules-tests/` with `@firebase/rules-unit-testing`.
9. Execute builds and tests:
   - `npm install` where needed.
   - `npm --prefix functions run build` (tsc) -> Must succeed with 0 errors.
   - `npm --prefix functions test` -> All unit tests must pass.
   - Run rules tests and mock-storage checks.
10. Commit changes locally using author `RexxLostHer <7dosabesar557@gmail.com>`. NEVER git push.
11. Write your detailed handoff report in `handoff.md` with build & test command logs.
12. Send completion message to parent when done.


## 2026-10-06T00:56:50Z
You are m1_worker. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_worker\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md and C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md.
Follow the implementation blueprints from:
- C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_1\handoff.md
- C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_2\handoff.md
- C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_3\handoff.md
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
Execute:
1. Workspace cleanup of 35 legacy files, preserving assets/logo-nesas.png and assets/logo-rpl.png.
2. Root package.json, firebase.json, .firebaserc, firestore.rules, firestore.indexes.json.
3. mock-storage/server.js.
4. seed/seed.js and seed/roster-data.json.
5. functions/ (TypeScript callables, triggers, helpers, and unit tests).
6. rules-tests/ (@firebase/rules-unit-testing).
7. Run builds and tests (npm --prefix functions run build, npm --prefix functions test, etc.).
8. Commit locally with author RexxLostHer <7dosabesar557@gmail.com>. Never git push.
Write your handoff report to handoff.md and send message to parent when done.
