# BRIEFING — 2026-10-06T01:27:00Z

## Mission
Investigate and design surgical fixes for Cloud Functions issues identified by Reviewer 1 and Challenger 1.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, analyzer, architect
- Working directory: C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_funcs
- Original parent: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Milestone: M1 Iteration 2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Design surgical, production-ready fixes for Cloud Functions
- Follow anti-slop guidelines and strict precision

## Current Parent
- Conversation ID: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Updated: 2026-10-06T01:27:00Z

## Investigation State
- **Explored paths**:
  - `functions/src/triggers/verifyAttendance.ts` (placement check, distance formatting, QR expiration NaN guard)
  - `functions/src/triggers/verifyCheckout.ts` (cross-company check, distance formatting, QR expiration NaN guard)
  - `functions/src/triggers/onApplicationDecided.ts` (Eventarc retry idempotency, cross-company conflict guard)
  - `functions/src/triggers/markAbsentees.ts` (batch write chunking <= 400 operations, chunked parallel reads)
  - `seed/seed.js` (`uid` on attendance doc, `isActive: true` on student, ISO date format)
  - `functions/test/` (analyzed test suites, facade tests issue, vitest harness)
  - `firestore.rules` (confirmed line 178 `resource.data.uid` multi-tenant requirement)
  - `m1_reviewer_1/handoff.md` and `m1_challenger_1/handoff.md` (validated all findings against code)
- **Key findings**:
  1. `verifyAttendance.ts`: Missing `!userData.companyId` check allows unplaced students to check in; `Math.round(distance)` creates confusing "50m > 50m" error for distances in (50, 50.5]m.
  2. `verifyCheckout.ts`: Omits `attData.companyId === companyId`, allowing checkout at different companies; shares distance rounding bug.
  3. Dynamic QR expiration: `new Date(undefined).getTime()` yields `NaN`, causing `nowMs > NaN + 30000` to evaluate to `false` and bypass expiration in both check-in and checkout.
  4. `onApplicationDecided.ts`: Lacks idempotency check; Eventarc retries re-evaluate transaction against already-updated state, causing double quota increment or reversal to 'ditolak'.
  5. `markAbsentees.ts`: Single batch write crashes at > 500 writes; sequential `await attRef.get()` introduces N+1 performance bottleneck.
  6. `seed/seed.js`: Missing `uid` on seeded attendance violates `firestore.rules` line 178; missing `isActive: true` excludes demo student from `markAbsentees.ts`.
- **Unexplored areas**: None within the assigned functions remediation scope.

## Key Decisions Made
- Extracted shared QR parsing pattern (or utility) with explicit `isNaN` and `isFinite` validation.
- Designed 3-way read upfront transaction with `alreadyProcessed` short-circuit for `onApplicationDecided.ts`.
- Implemented batch chunking with `BATCH_LIMIT = 400` and parallel read chunking (`READ_CHUNK_SIZE = 50`) for `markAbsentees.ts`.
- Outlined exact before/after code blocks for implementer `m1_worker`.

## Artifact Index
- DISPATCH.md — Task assignment and instructions
- progress.md — Liveness heartbeat and progress tracking
- handoff.md — Complete 5-component architectural remediation blueprint
