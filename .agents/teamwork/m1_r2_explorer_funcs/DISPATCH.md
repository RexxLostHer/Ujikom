# Task Assignment: M1 Iteration 2 Functions Remediation Explorer

You are `m1_r2_explorer_funcs`, a teamwork_preview_explorer agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_funcs`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Iteration 1 Gate failed on Cloud Functions edge cases identified by Reviewer 1 and Challenger 1.
Read:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\`
- Reviewer 1 findings: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_reviewer_1\handoff.md`
- Challenger 1 findings: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_challenger_1\handoff.md`

Your tasks:
Formulate surgical, production-ready fix recommendations for `functions/src/`:
1. `verifyAttendance.ts`:
   - Require student to be assigned to the company (`userData.companyId == companyId`), preventing unplaced students from checking in.
   - Fix distance rounding error in error messages for distances in (50, 50.5]m (use `distance.toFixed(1)}m > ${geofenceRadius}m`).
2. `verifyCheckout.ts`:
   - Enforce that the check-out company matches `attendanceDoc.companyId`.
3. QR Expiration logic:
   - Ensure `expiresAt` is verified to be a valid timestamp / integer, rejecting missing or NaN timestamps.
4. `onApplicationDecided.ts`:
   - Ensure transaction idempotency if Cloud Functions retries event delivery.
5. `markAbsentees.ts`:
   - Chunk Firestore batch writes to <= 400 operations per commit to prevent crash when > 500 students are absent.
6. `seed/seed.js`:
   - Add `uid` to seeded attendance document so client Firestore rules permit reads.

Write your remediation blueprint to `handoff.md` in your directory.
Report back via `send_message`.


## 2026-10-06T01:22:35Z
[Message] timestamp=2026-10-06T01:22:35Z sender=e93d1db5-4dd6-49bd-a8fc-9864437f62e2 priority=MESSAGE_PRIORITY_HIGH content=You are m1_r2_explorer_funcs. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_funcs\DISPATCH.md.
Read functions/src/ and the findings of reviewer 1 and challenger 1.
Design surgical fixes for Cloud Functions:
1. verifyAttendance student placement check & distance formatting fix.
2. verifyCheckout company match check.
3. Dynamic QR expiresAt NaN check.
4. onApplicationDecided idempotency.
5. markAbsentees batch chunking.
6. seed/seed.js attendance uid.
Write your report to handoff.md and send message to parent when done.
