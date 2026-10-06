# Task Assignment: M1 Iteration 2 Security Bypass Challenger

You are `m1_r2_challenger_2`, a teamwork_preview_challenger agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_challenger_2`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Adversarially challenge `firestore.rules` after Iteration 2 patches:
1. Attempt user self-escalation: Can a user update `role: 'admin'` or `schoolId: null`?
2. Attempt attendance bypass on create: Can a user inject `checkOut` or `logbookSubmitted: true`?
3. Attempt attendance bypass on update: Can a user modify `status` (clear alpha)?
4. Attempt delete operations on `academicYears`, `majors`, `roster`: Does deletion succeed for school admin without null runtime errors?
5. Provide an empirical verdict (APPROVE or REQUEST_CHANGES) with concrete evidence in `handoff.md`.
6. Send message to parent when done.
