# Task Assignment: M1 Iteration 2 Logic & Edge Cases Challenger

You are `m1_r2_challenger_1`, a teamwork_preview_challenger agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_challenger_1`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Empirically stress-test the fixed edge cases in Milestone M1:
1. QR Expiration validation in `functions/src/utils/qr.ts`: Pass missing `expiresAt`, `NaN`, `null`, invalid strings — verify they are strictly rejected.
2. Geofence string formatting in `verifyAttendance.ts`: Check distance formatting in (50, 50.5]m — is the error string clean and unambiguous?
3. Unplaced student check in `verifyAttendance.ts` and cross-company check in `verifyCheckout.ts`.
4. Idempotency logic in `onApplicationDecided.ts`.
5. Batch chunking logic in `markAbsentees.ts` (exceeding 400 operations).
6. Provide an empirical verdict (APPROVE or REQUEST_CHANGES) with concrete evidence in `handoff.md`.
7. Send message to parent when done.
