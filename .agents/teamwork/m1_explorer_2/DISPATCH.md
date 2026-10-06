# Task Assignment: M1 Cloud Functions Explorer

You are `m1_explorer_2`, a teamwork_preview_explorer agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_2`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Read:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\handoff.md`

Your tasks:
Investigate and design the exact implementation plan for `functions/` (Firebase Cloud Functions in TypeScript):
1. Project configuration (`functions/package.json`, `tsconfig.json`, build scripts).
2. Helpers in `functions/src/utils/`:
   - `geo.ts`: Haversine distance formula with exact spherical geometry math (radius 6371km), <= 50m threshold.
   - `notify.ts`: In-app notification creation in `users/{uid}/notifications`.
   - `r2.ts`: S3 client configured for either Cloudflare R2 or local mock (`http://127.0.0.1:9090`).
   - `admin.ts`: Firebase Admin initialization.
3. Callable functions in `functions/src/callable/`:
   - `lookupNisn.ts`: Verifies student NISN against `roster` collection.
   - `completeRegistration.ts`: Atomically creates `users/{uid}` and marks `roster` as `isRegistered = true`.
   - `getUploadUrl.ts`: Issues S3/R2 presigned PUT URL for logbook photos and final report PDFs.
4. Firestore Triggers in `functions/src/triggers/`:
   - `verifyAttendance.ts`: On attendance check-in update/create, verifies server-side Haversine distance and dynamic QR token validity.
   - `verifyCheckout.ts`: On attendance check-out, enforces `logbookSubmitted == true` and verifies geofence.
   - `onLogbookCreated.ts`: When logbook is created, sets `attendances/{uid_date}.logbookSubmitted = true`.
   - `onLogbookReviewed.ts`: Notifies student upon review status change.
   - `onApplicationDecided.ts`: Transactionally updates company `filledQuota` (checks against `quota`) and student assignment.
   - `onAssessmentFinalized.ts`: Evaluates score against school `talentThreshold` and sets `isRecommendedTalent = true`.
   - `onSosStatusChanged.ts`: Dispatches notification when teacher updates SOS report status or note.
   - `markAbsentees.ts`: Scheduled or callable function marking non-checked-in students as alpha.
5. Unit test suite in `functions/test/` with full assertions for each function.

Write your findings and implementation blueprints to `handoff.md` in your directory.
Report back via `send_message`.

## 2026-10-06T00:49:58Z
You are m1_explorer_2. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_2\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md and C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\handoff.md.
Investigate and produce concrete implementation plan for functions/ (TypeScript):
1. Callables: lookupNisn, completeRegistration, getUploadUrl.
2. Triggers: verifyAttendance, verifyCheckout, onLogbookCreated, onLogbookReviewed, onApplicationDecided, onAssessmentFinalized, onSosStatusChanged, markAbsentees.
3. Helpers: geo.ts (50m Haversine), notify.ts, r2.ts, admin.ts.
4. Unit tests in functions/test/ with test runners and assertion fixtures.
Write your report to handoff.md in your directory and send message to parent when done.
