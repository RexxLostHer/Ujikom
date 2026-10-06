# Task Assignment: M1 Iteration 2 Remediation Worker

You are `m1_worker_r2`, a teamwork_preview_worker agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_worker_r2`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & File Ownership
You exclusively own:
- `firestore.rules` (applying security patches from `m1_r2_explorer_rules/handoff.md`).
- `functions/src/` and `seed/seed.js` (applying patches from `m1_r2_explorer_funcs/handoff.md`).
- `functions/test/` and `rules-tests/` (refactoring unit tests to import directly from `src/` and adding negative rules assertions from `m1_r2_explorer_tests/handoff.md`).

You do NOT touch `vokalog_app/` or `e2e/`.

## Authoritative Inputs to Read
Read the 3 remediation blueprints:
1. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules\handoff.md`
2. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_funcs\handoff.md`
3. `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_tests\handoff.md`

## Concrete Tasks
1. Update `firestore.rules`:
   - Enforce `users/{userId}` update whitelist (`name`, `displayName`, `phone`, `fcmToken`, `photoUrl`, `updatedAt`). Block self-escalation of `role` and `schoolId`.
   - Update `attendances` `create`: enforce `schoolId == getSchoolId()`, `logbookSubmitted == false`, prohibit `checkOut`.
   - Update `attendances` `update`: positive whitelist (`notes`, `checkOut`, `updatedAt`).
   - Fix `delete` rules in `academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, `roster` to check `resource.data.schoolId`.
2. Update `functions/src/`:
   - `verifyAttendance.ts`: Enforce student placement (`userData.companyId == companyId`), fix distance string formatting.
   - `verifyCheckout.ts`: Verify check-in company matches target company.
   - QR validation: Reject missing/NaN `expiresAt`.
   - `onApplicationDecided.ts`: Idempotent handling for retries.
   - `markAbsentees.ts`: Batch chunking at <= 400 operations.
   - `seed/seed.js`: Ensure seeded attendance has `uid`, student has `isActive: true`, and date format is ISO YYYY-MM-DD.
3. Refactor `functions/test/`:
   - Import handlers/helpers directly from `../src/` instead of isolated dummy mock replicas.
   - Add negative tests in `rules-tests/firestore-rules.test.ts` for the patched security invariants.
4. Run builds and tests:
   - `npm --prefix functions run build` (tsc) -> 0 errors.
   - `npm --prefix functions test` -> 100% pass.
   - Run rules tests and verify.
5. Commit locally with author `RexxLostHer <7dosabesar557@gmail.com>`. Never git push.
6. Write `handoff.md` with build & test outputs and send completion message to parent.
