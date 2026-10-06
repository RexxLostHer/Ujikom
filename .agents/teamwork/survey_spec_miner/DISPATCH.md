# Task Assignment: PRD Specification Miner

You are `survey_spec_miner`, a teamwork_preview_spec_miner agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Read and extract full specifications from:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\brain\e42361f2-42b6-4619-823e-980ca4511aed\scratch\prd.txt`

Specifically extract:
1. All 5 actors and their permissions/roles (`super_admin`, `admin_sekolah`, `pembimbing_instansi`, `guru_pembimbing`, `siswa`).
2. All 17 Firestore entities from Class Diagram and ERD (including collection names, document ID schemes, exact field names, types, subcollections vs root collections, tenant scoping via `schoolId`, platform-level `companies`).
3. Complete enumeration of all 21 PRD Bab III flows (3.4 to 3.21 + QR generation 1.6 + Admin approval 1.7):
   - Sequence of events, inputs, triggers, validation rules, state transitions, notifications generated.
4. Exact Cloud Function signatures and specifications:
   - Callable functions: `lookupNisn`, `completeRegistration`, `getUploadUrl`.
   - Firestore Triggers: `verifyAttendance`, `verifyCheckout`, `onLogbookCreated`, `onLogbookReviewed`, `onApplicationDecided`, `onAssessmentFinalized`, `onSosStatusChanged`, `markAbsentees`.
   - Helper libraries: `geo.ts` (haversine formulas, geofence radius default 50m), `notify.ts`, `r2.ts`.
5. Exact Firestore Security Rules constraints mentioned in PRD and acceptance criteria.
6. Roster specifications (XII RPL 1, XII RPL 2, XII TKJ 1) and seed data needs.

Produce a detailed specification handoff in `handoff.md` in your working directory.
Report back via `send_message` when done.

## 2026-10-06T00:34:10Z
[Message] timestamp=2026-10-06T00:34:10Z sender=e93d1db5-4dd6-49bd-a8fc-9864437f62e2 priority=MESSAGE_PRIORITY_HIGH content=You are survey_spec_miner. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\DISPATCH.md.
Exhaustively read and extract specifications from:
- C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md
- C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\brain\e42361f2-42b6-4619-823e-980ca4511aed\scratch\prd.txt
Extract all 17 Firestore entities with fields/types, 21 Bab III flows, 5 actors, callable/trigger functions, security rules constraints, and roster specs.
Write your full specification report to C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\handoff.md.
Send a message to parent when done.
