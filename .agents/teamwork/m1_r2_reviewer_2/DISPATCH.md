# Task Assignment: M1 Iteration 2 Security Rules Reviewer

You are `m1_r2_reviewer_2`, a teamwork_preview_reviewer agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_reviewer_2`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Review the security rules remediations in `firestore.rules` and `rules-tests/firestore-rules.test.ts`:
1. Check `users/{userId}`: Are direct creation and self-escalation of `role`/`schoolId` blocked? Is update whitelist strictly enforced?
2. Check `attendances/{id}`: Is `logbookSubmitted == false` and `!('checkOut' in request.resource.data)` enforced on `create`? Is positive whitelist enforced on `update`?
3. Check secondary collections (`academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, `roster`): Is the `delete` null dereference bug resolved using `resource.data.schoolId`? Are updates tenant-locked?
4. Inspect `rules-tests/firestore-rules.test.ts` for Invariants 8, 9, 10, 11 negative test assertions.
5. Provide your objective verdict (APPROVE or REQUEST_CHANGES) with concrete evidence in `handoff.md`.
6. Send message to parent when done.
