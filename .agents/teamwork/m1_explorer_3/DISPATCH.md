# Task Assignment: M1 Security Rules Explorer

You are `m1_explorer_3`, a teamwork_preview_spec_miner agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_3`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Read:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\ORIGINAL_REQUEST.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md`
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\handoff.md`

Your tasks:
Investigate and design the exact implementation plan for:
1. `firestore.rules`:
   - Multi-tenant school isolation (`schoolId`).
   - Role-based permissions across all 17 entities for all 5 actors.
   - Company deletion permitted exclusively for Super Admin (`role == 'admin' && schoolId == null`).
   - Company update restricted via `affectedKeys().hasOnly(['name', 'address', 'lat', 'lng', 'geofenceRadiusMeters', 'jurusanAllowed', 'quota'])`.
   - Application creation: studentId must match auth.uid, status must be `'menunggu'`.
   - Attendance checkout gate: update containing `checkOut` is rejected unless `resource.data.logbookSubmitted == true`.
   - Logbook review: only Pembimbing Instansi belonging to the same `companyId`.
   - Final report review: only Admin Sekolah from same school, restricted to `affectedKeys().hasOnly(['status', 'certificateUrl', 'reviewedBy', 'reviewedAt'])`.
2. `@firebase/rules-unit-testing` test suite in `rules-tests/`:
   - Package setup (`package.json`, Vitest/Jest/Mocha config).
   - Test cases explicitly asserting each of the 7 security invariants from the acceptance criteria against Firestore Emulator.

Write your findings and implementation blueprints to `handoff.md` in your directory.
Report back via `send_message`.


## 2026-10-06T00:49:58Z
You are m1_explorer_3. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_3\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md and C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\survey_spec_miner\handoff.md.
Investigate and produce concrete implementation plan for:
1. firestore.rules: multi-tenant isolation, role permissions, company deletion exclusively for Super Admin, company edit field whitelist, application creation rules, attendance checkout barrier (logbookSubmitted == true), logbook review same company, finalReports admin whitelist.
2. rules-tests/ test suite using @firebase/rules-unit-testing verifying all 7 security invariants against Firestore emulator.
Write your report to handoff.md in your directory and send message to parent when done.
