# Task Assignment: M1 Security Rules Reviewer

You are `m1_reviewer_2`, a teamwork_preview_reviewer agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_reviewer_2`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Review the security rules and unit test implementation of Milestone M1 created by `m1_worker`:
1. Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `m1_worker/handoff.md`.
2. Inspect `firestore.rules` for:
   - Multi-tenant data isolation (`schoolId`).
   - Invariant 1: Company deletion permitted exclusively for Super Admin.
   - Invariant 2: Company update restricted via whitelist (`name, address, lat, lng, geofenceRadiusMeters, jurusanAllowed, quota`).
   - Invariant 3: Application creation enforces `studentId == auth.uid` and status `'menunggu'`.
   - Invariant 4: Check-out update denied unless `logbookSubmitted == true`.
   - Invariant 5: Logbook review restricted to mentor of same `companyId`.
   - Invariant 6: Final report admin update whitelist (`status, certificateUrl, reviewedBy, reviewedAt`).
   - Invariant 7: Cross-school reads and writes denied.
3. Inspect `rules-tests/` test suite and verify test assertions.
4. Run tests if emulator is running or inspect tests with Vitest/Mocha.
5. Provide an objective verdict (APPROVE or REQUEST_CHANGES) with supporting evidence in `handoff.md`.
6. Send message to parent when done.


## 2026-10-06T01:12:43Z
You are m1_reviewer_2. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_reviewer_2\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\PROJECT.md and C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_worker\handoff.md.
Review firestore.rules and rules-tests/ test suite against the 7 security invariants and multi-tenant isolation.
Provide your verdict (APPROVE or REQUEST_CHANGES) in handoff.md and send message to parent when done.
